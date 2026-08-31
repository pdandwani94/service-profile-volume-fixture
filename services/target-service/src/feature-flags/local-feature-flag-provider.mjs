import { FEATURE_FLAG_DEFAULTS } from './flag-catalog.mjs';

export class LocalFeatureFlagProvider {
  constructor(overrides = {}) {
    this.values = { ...FEATURE_FLAG_DEFAULTS, ...overrides };
  }

  async booleanVariation(key, _context, defaultValue) {
    const value = this.values[key];
    return typeof value === 'boolean' ? value : defaultValue;
  }

  async close() {}
}
