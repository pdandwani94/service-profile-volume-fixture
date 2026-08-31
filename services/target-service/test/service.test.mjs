import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderService } from '../src/application/order-service.mjs';
import { FEATURE_FLAGS } from '../src/feature-flags/flag-catalog.mjs';
import { LaunchDarklyFeatureFlagProvider } from '../src/feature-flags/launchdarkly-feature-flag-provider.mjs';
import { LOG_EVENTS } from '../src/observability/log-event-catalog.mjs';

class RecordingFeatureFlagProvider {
  constructor(values = {}) {
    this.values = values;
    this.evaluations = [];
  }

  async booleanVariation(key, context, defaultValue) {
    this.evaluations.push({ key, context, defaultValue });
    return this.values[key] ?? defaultValue;
  }
}

class RecordingMetrics {
  accepted = [];
  rejected = [];
  notifications = [];

  recordBatchAccepted(value) { this.accepted.push(value); }

  recordBatchRejected(value) { this.rejected.push(value); }

  recordNotifications(value) { this.notifications.push(value); }
}

class RecordingLogger {
  records = [];

  info(fields, message) { this.records.push({ level: 'info', fields, message }); }

  warn(fields, message) { this.records.push({ level: 'warn', fields, message }); }
}

test('accepts a bounded batch and evaluates every production feature flag', async () => {
  const featureFlags = new RecordingFeatureFlagProvider();
  const metrics = new RecordingMetrics();
  const logger = new RecordingLogger();
  const service = new OrderService({ featureFlags, metrics, logger });

  assert.equal(await service.createBatch([{ id: 'o-1', tenantId: 't-1', amountMinor: 100 }]), 1);
  assert.deepEqual(featureFlags.evaluations.map((evaluation) => evaluation.key), [
    FEATURE_FLAGS.REJECT_DUPLICATE_ORDER_IDS,
    FEATURE_FLAGS.SEND_REFERENCE_NOTIFICATIONS,
    FEATURE_FLAGS.EMIT_AUDIT_LOGS,
  ]);
  assert.deepEqual(featureFlags.evaluations.map((evaluation) => evaluation.defaultValue), [true, false, true]);
  assert.ok(featureFlags.evaluations.every((evaluation) => evaluation.context.key === 't-1'));
  assert.equal(metrics.accepted.length, 1);
  assert.equal(logger.records.at(-1).fields.event, LOG_EVENTS.BATCH_ACCEPTED);
});

test('feature flags change duplicate handling, notifications, and audit logging', async () => {
  const featureFlags = new RecordingFeatureFlagProvider({
    [FEATURE_FLAGS.REJECT_DUPLICATE_ORDER_IDS]: false,
    [FEATURE_FLAGS.SEND_REFERENCE_NOTIFICATIONS]: true,
    [FEATURE_FLAGS.EMIT_AUDIT_LOGS]: false,
  });
  const notified = [];
  const notifier = { async notify(orderId) { notified.push(orderId); } };
  const metrics = new RecordingMetrics();
  const logger = new RecordingLogger();
  const service = new OrderService({ featureFlags, notifier, metrics, logger });

  const duplicateOrders = [
    { id: 'o-1', tenantId: 't-1', amountMinor: 100 },
    { id: 'o-1', tenantId: 't-1', amountMinor: 200 },
  ];
  assert.equal(await service.createBatch(duplicateOrders), 1);
  assert.deepEqual(notified, ['o-1', 'o-1']);
  assert.deepEqual(metrics.notifications, [2]);
  assert.ok(logger.records.some((record) => record.fields.event === LOG_EVENTS.NOTIFICATIONS_DISPATCHED));
  assert.ok(!logger.records.some((record) => record.fields.event === LOG_EVENTS.BATCH_ACCEPTED));
});

test('rejects duplicate order IDs by default and records the reason', async () => {
  const metrics = new RecordingMetrics();
  const logger = new RecordingLogger();
  const service = new OrderService({ metrics, logger });
  const duplicateOrders = [
    { id: 'o-1', tenantId: 't-1', amountMinor: 100 },
    { id: 'o-1', tenantId: 't-1', amountMinor: 200 },
  ];

  await assert.rejects(service.createBatch(duplicateOrders), /duplicate_order_id/);
  assert.equal(metrics.rejected[0].reason, 'duplicate_order_id');
  assert.equal(logger.records[0].fields.event, LOG_EVENTS.BATCH_REJECTED);
});

test('bounds unexpected failures to a stable metric reason', async () => {
  const metrics = new RecordingMetrics();
  const featureFlags = {
    async booleanVariation() { throw new Error('provider-specific transient detail'); },
  };
  const service = new OrderService({ featureFlags, metrics });

  await assert.rejects(
    service.createBatch([{ id: 'o-1', tenantId: 't-1', amountMinor: 100 }]),
    /provider-specific transient detail/,
  );
  assert.equal(metrics.rejected[0].reason, 'unexpected_error');
});

test('LaunchDarkly adapter initializes with a timeout, delegates variation, and closes cleanly', async () => {
  const calls = [];
  const client = {
    async waitForInitialization(options) { calls.push(['waitForInitialization', options]); },
    async variation(...args) { calls.push(['variation', ...args]); return true; },
    async flush() { calls.push(['flush']); },
    async close() { calls.push(['close']); },
  };
  const provider = await LaunchDarklyFeatureFlagProvider.connect({
    sdkKey: 'test-sdk-key',
    timeoutSeconds: 3,
    initializeClient(sdkKey) {
      calls.push(['init', sdkKey]);
      return client;
    },
  });
  const context = { kind: 'tenant', key: 't-1' };

  assert.equal(await provider.booleanVariation('example.flag', context, false), true);
  await provider.close();
  assert.deepEqual(calls, [
    ['init', 'test-sdk-key'],
    ['waitForInitialization', { timeoutSeconds: 3 }],
    ['variation', 'example.flag', context, false],
    ['flush'],
    ['close'],
  ]);
});
