import { createServer } from 'node:http';
import { config } from './config.mjs';
import { OrderService } from './application/order-service.mjs';
import { VolumeLimitExceeded } from './domain/errors.mjs';

const service = new OrderService();

createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health/ready') {
    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ status: 'ready' }));
    return;
  }
  if (request.method === 'POST' && request.url === '/v1/volume-orders') {
    const chunks = [];
    request.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    request.on('end', () => {
      try {
        const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
        const currentCount = service.createBatch(payload.orders);
        response.writeHead(202, { 'content-type': 'application/json' });
        response.end(JSON.stringify({ accepted: true, currentCount }));
      } catch (error) {
        const status = error instanceof VolumeLimitExceeded ? error.status : 400;
        const code = error instanceof VolumeLimitExceeded ? error.code : 'invalid_volume_order';
        response.writeHead(status, { 'content-type': 'application/problem+json' });
        response.end(JSON.stringify({ title: code, status }));
      }
    });
    return;
  }
  response.writeHead(404).end();
}).listen(config.PORT);
