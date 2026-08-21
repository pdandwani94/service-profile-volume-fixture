import test from 'node:test';
import assert from 'node:assert/strict';
import { OrderService } from '../src/application/order-service.mjs';

test('accepts a bounded batch', () => {
  const service = new OrderService();
  assert.equal(service.createBatch([{ id: 'o-1', tenantId: 't-1', amountMinor: 100 }]), 1);
});
