import pino from 'pino';

export function createLogger({ level = 'info', destination } = {}) {
  const options = {
    name: 'profile-volume-target',
    level,
    base: { service: 'profile-volume-target' },
    redact: {
      paths: ['sdkKey', '*.sdkKey'],
      censor: '[Redacted]',
    },
  };

  return destination ? pino(options, destination) : pino(options);
}

export const noopLogger = Object.freeze({
  debug() {},
  info() {},
  warn() {},
  error() {},
});
