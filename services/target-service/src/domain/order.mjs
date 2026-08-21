export function validateOrder(order) {
  if (!order.id || !order.tenantId || !Number.isSafeInteger(order.amountMinor) || order.amountMinor < 1) {
    throw new Error('invalid_volume_order');
  }
}
