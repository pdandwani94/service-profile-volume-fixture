import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderService } from '../src/application/order-service.mjs';

test('maps a batch larger than 500 to volume_limit_exceeded', () => {
  const service = new OrderService();
  const orders = Array.from({ length: 501 }, (_, index) => ({
    id: `o-${index}`,
    tenantId: 't-1',
    amountMinor: 100,
  }));
  assert.throws(() => service.createBatch(orders), /volume_limit_exceeded/);
});
