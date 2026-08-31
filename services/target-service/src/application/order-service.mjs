import { config } from '../config.mjs';
import { ReferenceNotifier } from '../adapters/reference-notifier.mjs';
import { DuplicateOrderId, VolumeLimitExceeded } from '../domain/errors.mjs';
import { validateOrder } from '../domain/order.mjs';
import { FEATURE_FLAGS } from '../feature-flags/flag-catalog.mjs';
import { LocalFeatureFlagProvider } from '../feature-flags/local-feature-flag-provider.mjs';
import { LOG_EVENTS } from '../observability/log-event-catalog.mjs';
import { NoopOrderMetrics } from '../observability/prometheus-order-metrics.mjs';
import { noopLogger } from '../observability/logger.mjs';
import { InMemoryOrderRepository } from '../persistence/in-memory-order-repository.mjs';

function findDuplicateOrderId(orders) {
  const orderIds = new Set();
  for (const order of orders) {
    if (orderIds.has(order.id)) return order.id;
    orderIds.add(order.id);
  }
  return undefined;
}

function contextFor(orders) {
  return {
    kind: 'tenant',
    key: orders[0]?.tenantId ?? 'unknown-tenant',
  };
}

function rejectionReason(error) {
  if (error.code) return error.code;
  if (error.message === 'invalid_volume_order') return 'invalid_volume_order';
  return 'unexpected_error';
}

export class OrderService {
  constructor({
    repository = new InMemoryOrderRepository(),
    featureFlags = new LocalFeatureFlagProvider(),
    notifier = new ReferenceNotifier(),
    metrics = new NoopOrderMetrics(),
    logger = noopLogger,
    clock = performance,
  } = {}) {
    this.repository = repository;
    this.featureFlags = featureFlags;
    this.notifier = notifier;
    this.metrics = metrics;
    this.logger = logger;
    this.clock = clock;
  }

  async createBatch(orders) {
    const startedAt = this.clock.now();
    const batchSize = Array.isArray(orders) ? orders.length : 0;

    try {
      if (!Array.isArray(orders)) throw new Error('invalid_volume_order');

      const evaluationContext = contextFor(orders);
      const [rejectDuplicateOrderIds, sendReferenceNotifications, emitAuditLogs] = await Promise.all([
        this.featureFlags.booleanVariation(
          FEATURE_FLAGS.REJECT_DUPLICATE_ORDER_IDS,
          evaluationContext,
          true,
        ),
        this.featureFlags.booleanVariation(
          FEATURE_FLAGS.SEND_REFERENCE_NOTIFICATIONS,
          evaluationContext,
          false,
        ),
        this.featureFlags.booleanVariation(
          FEATURE_FLAGS.EMIT_AUDIT_LOGS,
          evaluationContext,
          true,
        ),
      ]);

      if (orders.length > config.MAX_BATCH_SIZE) throw new VolumeLimitExceeded();
      orders.forEach(validateOrder);

      if (rejectDuplicateOrderIds) {
        const duplicateOrderId = findDuplicateOrderId(orders);
        if (duplicateOrderId) throw new DuplicateOrderId(duplicateOrderId);
      }

      orders.forEach((order) => this.repository.save(order));

      if (sendReferenceNotifications) {
        await Promise.all(orders.map((order) => this.notifier.notify(order.id)));
        this.metrics.recordNotifications(orders.length);
        this.logger.info({
          event: LOG_EVENTS.NOTIFICATIONS_DISPATCHED,
          notificationCount: orders.length,
        }, 'Reference notifications dispatched');
      }

      const durationSeconds = (this.clock.now() - startedAt) / 1_000;
      this.metrics.recordBatchAccepted({ batchSize: orders.length, durationSeconds });

      if (emitAuditLogs) {
        this.logger.info({
          event: LOG_EVENTS.BATCH_ACCEPTED,
          batchSize: orders.length,
          currentCount: this.repository.count(),
        }, 'Volume order batch accepted');
      }

      return this.repository.count();
    } catch (error) {
      const reason = rejectionReason(error);
      const durationSeconds = (this.clock.now() - startedAt) / 1_000;
      this.metrics.recordBatchRejected({ reason, durationSeconds });
      this.logger.warn({
        event: LOG_EVENTS.BATCH_REJECTED,
        batchSize,
        reason,
      }, 'Volume order batch rejected');
      throw error;
    }
  }
}
