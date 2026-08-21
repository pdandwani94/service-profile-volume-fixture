export class InMemoryOrderRepository {
  #orders = new Map();

  save(order) {
    this.#orders.set(order.id, order);
  }

  count() {
    return this.#orders.size;
  }
}
