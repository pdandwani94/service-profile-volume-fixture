export const FEATURE_FLAGS = Object.freeze({
  REJECT_DUPLICATE_ORDER_IDS: 'volume-orders.reject-duplicate-order-ids',
  SEND_REFERENCE_NOTIFICATIONS: 'volume-orders.send-reference-notifications',
  EMIT_AUDIT_LOGS: 'volume-orders.emit-audit-logs',
});

export const FEATURE_FLAG_DEFAULTS = Object.freeze({
  [FEATURE_FLAGS.REJECT_DUPLICATE_ORDER_IDS]: true,
  [FEATURE_FLAGS.SEND_REFERENCE_NOTIFICATIONS]: false,
  [FEATURE_FLAGS.EMIT_AUDIT_LOGS]: true,
});
