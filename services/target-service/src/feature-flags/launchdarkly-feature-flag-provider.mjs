import { init } from '@launchdarkly/node-server-sdk';

export class LaunchDarklyFeatureFlagProvider {
  constructor(client) {
    this.client = client;
  }

  static async connect({ sdkKey, timeoutSeconds = 5, initializeClient = init }) {
    if (!sdkKey) throw new Error('LAUNCHDARKLY_SDK_KEY is required');

    const client = initializeClient(sdkKey);
    try {
      await client.waitForInitialization({ timeoutSeconds });
      return new LaunchDarklyFeatureFlagProvider(client);
    } catch (error) {
      await client.close();
      throw error;
    }
  }

  async booleanVariation(key, context, defaultValue) {
    return this.client.variation(key, context, defaultValue);
  }

  async close() {
    await this.client.flush();
    await this.client.close();
  }
}
