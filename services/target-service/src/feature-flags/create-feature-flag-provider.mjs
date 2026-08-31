import { LOG_EVENTS } from '../observability/log-event-catalog.mjs';
import { LaunchDarklyFeatureFlagProvider } from './launchdarkly-feature-flag-provider.mjs';
import { LocalFeatureFlagProvider } from './local-feature-flag-provider.mjs';

export async function createFeatureFlagProvider({
  sdkKey,
  localOverrides = {},
  timeoutSeconds = 5,
  logger,
}) {
  if (sdkKey) {
    try {
      const provider = await LaunchDarklyFeatureFlagProvider.connect({ sdkKey, timeoutSeconds });
      logger.info({ event: LOG_EVENTS.FEATURE_FLAG_PROVIDER_READY, provider: 'launchdarkly' },
        'LaunchDarkly feature flag provider is ready');
      return provider;
    } catch (error) {
      logger.warn({
        event: LOG_EVENTS.FEATURE_FLAG_PROVIDER_FALLBACK,
        provider: 'launchdarkly',
        fallbackProvider: 'local',
        errorMessage: error.message,
      }, 'Feature flag provider initialization failed; using local defaults');
    }
  } else {
    logger.info({
      event: LOG_EVENTS.FEATURE_FLAG_PROVIDER_FALLBACK,
      provider: 'local',
      reason: 'sdk_key_not_configured',
    }, 'LaunchDarkly SDK key is not configured; using local defaults');
  }

  return new LocalFeatureFlagProvider(localOverrides);
}
