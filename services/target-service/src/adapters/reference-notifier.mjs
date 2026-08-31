export class ReferenceNotifier {
  async notify(orderId) {
    return `reference-notification:${orderId}`;
  }
}
