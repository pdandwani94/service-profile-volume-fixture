import Prometheus from '@prometheus-io/client';
import { METRIC_NAMES } from './metric-catalog.mjs';

const { Counter, Histogram, Registry } = Prometheus;

export class PrometheusOrderMetrics {
  constructor(registry = new Registry()) {
    this.registry = registry;
    this.ordersCreated = new Counter({
      name: METRIC_NAMES.ORDERS_CREATED_TOTAL,
      help: 'Number of volume orders persisted successfully.',
      registers: [registry],
    });
    this.batchesAccepted = new Counter({
      name: METRIC_NAMES.BATCHES_ACCEPTED_TOTAL,
      help: 'Number of volume order batches accepted.',
      registers: [registry],
    });
    this.batchRejections = new Counter({
      name: METRIC_NAMES.BATCH_REJECTIONS_TOTAL,
      help: 'Number of volume order batches rejected by reason.',
      labelNames: ['reason'],
      registers: [registry],
    });
    this.batchSize = new Histogram({
      name: METRIC_NAMES.BATCH_SIZE,
      help: 'Number of orders in an accepted volume order batch.',
      buckets: [1, 10, 50, 100, 250, 500],
      registers: [registry],
    });
    this.processingDuration = new Histogram({
      name: METRIC_NAMES.PROCESSING_DURATION_SECONDS,
      help: 'Time spent processing a volume order batch in seconds.',
      buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1],
      registers: [registry],
    });
    this.notifications = new Counter({
      name: METRIC_NAMES.NOTIFICATIONS_TOTAL,
      help: 'Number of reference notifications dispatched.',
      registers: [registry],
    });
  }

  recordBatchAccepted({ batchSize, durationSeconds }) {
    this.ordersCreated.inc(batchSize);
    this.batchesAccepted.inc();
    this.batchSize.observe(batchSize);
    this.processingDuration.observe(durationSeconds);
  }

  recordBatchRejected({ reason, durationSeconds }) {
    this.batchRejections.inc({ reason });
    this.processingDuration.observe(durationSeconds);
  }

  recordNotifications(count) {
    this.notifications.inc(count);
  }

  async render() {
    return this.registry.metrics();
  }

  get contentType() {
    return this.registry.contentType;
  }
}

export class NoopOrderMetrics {
  recordBatchAccepted() {}

  recordBatchRejected() {}

  recordNotifications() {}
}
