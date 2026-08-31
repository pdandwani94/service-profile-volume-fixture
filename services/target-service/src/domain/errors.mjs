export class VolumeLimitExceeded extends Error {
  code = 'volume_limit_exceeded';
  status = 429;

  constructor() {
    super('volume_limit_exceeded');
  }
}

export class DuplicateOrderId extends Error {
  code = 'duplicate_order_id';
  status = 409;

  constructor(orderId) {
    super('duplicate_order_id');
    this.orderId = orderId;
  }
}
