import test from 'node:test';
import assert from 'node:assert/strict';
import { Writable } from 'node:stream';
import { OrderService } from '../src/application/order-service.mjs';
import { LocalFeatureFlagProvider } from '../src/feature-flags/local-feature-flag-provider.mjs';
import { LOG_EVENTS } from '../src/observability/log-event-catalog.mjs';
import { createLogger, noopLogger } from '../src/observability/logger.mjs';
import { METRIC_NAMES } from '../src/observability/metric-catalog.mjs';
import { PrometheusOrderMetrics } from '../src/observability/prometheus-order-metrics.mjs';
import { createHttpServer } from '../src/server.mjs';

async function withServer(callback) {
  const metrics = new PrometheusOrderMetrics();
  const service = new OrderService({
    featureFlags: new LocalFeatureFlagProvider(),
    metrics,
    logger: noopLogger,
  });
  const server = createHttpServer({ service, metrics });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
  }
}

test('maps a batch larger than 500 to volume_limit_exceeded', async () => {
  const service = new OrderService();
  const orders = Array.from({ length: 501 }, (_, index) => ({
    id: `o-${index}`,
    tenantId: 't-1',
    amountMinor: 100,
  }));
  await assert.rejects(service.createBatch(orders), /volume_limit_exceeded/);
});

test('serves live Prometheus metrics for accepted and rejected batches', async () => {
  await withServer(async (baseUrl) => {
    const acceptedResponse = await fetch(`${baseUrl}/v1/volume-orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        orders: [{ id: 'o-1', tenantId: 't-1', amountMinor: 100 }],
      }),
    });
    assert.equal(acceptedResponse.status, 202);

    const duplicateResponse = await fetch(`${baseUrl}/v1/volume-orders`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        orders: [
          { id: 'o-2', tenantId: 't-1', amountMinor: 100 },
          { id: 'o-2', tenantId: 't-1', amountMinor: 200 },
        ],
      }),
    });
    assert.equal(duplicateResponse.status, 409);

    const metricsResponse = await fetch(`${baseUrl}/metrics`);
    const metricsBody = await metricsResponse.text();
    assert.match(metricsResponse.headers.get('content-type'), /text\/plain/);
    assert.match(metricsBody, new RegExp(`${METRIC_NAMES.ORDERS_CREATED_TOTAL} 1`));
    assert.match(metricsBody, new RegExp(`${METRIC_NAMES.BATCHES_ACCEPTED_TOTAL} 1`));
    assert.match(metricsBody, new RegExp(`${METRIC_NAMES.BATCH_REJECTIONS_TOTAL}\\{reason="duplicate_order_id"\\} 1`));
    assert.match(metricsBody, new RegExp(`${METRIC_NAMES.PROCESSING_DURATION_SECONDS}_count 2`));
  });
});

test('Pino emits the stable structured event field from production code', async () => {
  const lines = [];
  const destination = new Writable({
    write(chunk, _encoding, callback) {
      lines.push(chunk.toString());
      callback();
    },
  });
  const logger = createLogger({ destination });
  const service = new OrderService({ logger });

  await service.createBatch([{ id: 'o-1', tenantId: 't-1', amountMinor: 100 }]);
  const records = lines.join('').trim().split('\n').map((line) => JSON.parse(line));
  assert.ok(records.some((record) => record.event === LOG_EVENTS.BATCH_ACCEPTED));
  assert.ok(records.every((record) => record.service === 'profile-volume-target'));
});
