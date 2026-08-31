import { createServer } from 'node:http';
import { pathToFileURL } from 'node:url';
import { config } from './config.mjs';
import { OrderService } from './application/order-service.mjs';
import { DuplicateOrderId, VolumeLimitExceeded } from './domain/errors.mjs';
import { createFeatureFlagProvider } from './feature-flags/create-feature-flag-provider.mjs';
import { createLogger } from './observability/logger.mjs';
import { PrometheusOrderMetrics } from './observability/prometheus-order-metrics.mjs';

async function readJson(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(Buffer.from(chunk));
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function writeJson(response, status, body, contentType = 'application/json') {
  response.writeHead(status, { 'content-type': contentType });
  response.end(JSON.stringify(body));
}

function problemFor(error) {
  if (error instanceof VolumeLimitExceeded || error instanceof DuplicateOrderId) {
    return { status: error.status, title: error.code };
  }
  return { status: 400, title: 'invalid_volume_order' };
}

export function createHttpServer({ service, metrics }) {
  return createServer(async (request, response) => {
    if (request.method === 'GET' && request.url === '/health/ready') {
      writeJson(response, 200, { status: 'ready' });
      return;
    }

    if (request.method === 'GET' && request.url === '/metrics') {
      response.writeHead(200, { 'content-type': metrics.contentType });
      response.end(await metrics.render());
      return;
    }

    if (request.method === 'POST' && request.url === '/v1/volume-orders') {
      try {
        const payload = await readJson(request);
        const currentCount = await service.createBatch(payload.orders);
        writeJson(response, 202, { accepted: true, currentCount });
      } catch (error) {
        const problem = problemFor(error);
        writeJson(response, problem.status, problem, 'application/problem+json');
      }
      return;
    }

    response.writeHead(404).end();
  });
}

export async function startServer() {
  const logger = createLogger({ level: config.LOG_LEVEL });
  const metrics = new PrometheusOrderMetrics();
  const featureFlags = await createFeatureFlagProvider({
    sdkKey: config.LAUNCHDARKLY_SDK_KEY,
    localOverrides: config.FEATURE_FLAG_OVERRIDES,
    timeoutSeconds: config.FEATURE_FLAG_INIT_TIMEOUT_SECONDS,
    logger,
  });
  const service = new OrderService({ featureFlags, metrics, logger });
  const server = createHttpServer({ service, metrics });

  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(config.PORT, resolve);
  });

  const shutdown = async () => {
    await new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
    await featureFlags.close();
  };
  process.once('SIGTERM', shutdown);
  process.once('SIGINT', shutdown);

  return { server, shutdown };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await startServer();
}
