import { config } from '../config.mjs';
import { VolumeLimitExceeded } from '../domain/errors.mjs';
import { validateOrder } from '../domain/order.mjs';
import { InMemoryOrderRepository } from '../persistence/in-memory-order-repository.mjs';

export class OrderService {
  constructor(repository = new InMemoryOrderRepository()) {
    this.repository = repository;
  }

  createBatch(orders) {
    if (orders.length > config.MAX_BATCH_SIZE) throw new VolumeLimitExceeded();
    orders.forEach((order) => {
      validateOrder(order);
      this.repository.save(order);
    });
    return this.repository.count();
  }
}
