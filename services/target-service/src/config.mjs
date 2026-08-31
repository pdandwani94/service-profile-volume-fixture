function parseFeatureFlagOverrides(serializedOverrides) {
  if (!serializedOverrides) return {};

  const overrides = JSON.parse(serializedOverrides);
  if (!overrides || Array.isArray(overrides) || typeof overrides !== 'object') {
    throw new Error('FEATURE_FLAG_OVERRIDES must be a JSON object');
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (typeof value !== 'boolean') {
      throw new Error(`FEATURE_FLAG_OVERRIDES value for ${key} must be boolean`);
    }
  }
  return overrides;
}

export const config = {
  PORT: Number(process.env.PORT ?? 8080),
  MAX_BATCH_SIZE: 500,
  STORE_KIND: 'memory',
  LAUNCHDARKLY_SDK_KEY: process.env.LAUNCHDARKLY_SDK_KEY,
  FEATURE_FLAG_OVERRIDES: parseFeatureFlagOverrides(process.env.FEATURE_FLAG_OVERRIDES),
  FEATURE_FLAG_INIT_TIMEOUT_SECONDS: Number(process.env.FEATURE_FLAG_INIT_TIMEOUT_SECONDS ?? 5),
  LOG_LEVEL: process.env.LOG_LEVEL ?? 'info',
};
