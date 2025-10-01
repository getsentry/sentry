import {renderHook} from 'sentry-test/reactTestingLibrary';

import localStorageWrapper from 'sentry/utils/localStorage';
import type {PreventAIConfig} from 'sentry/views/prevent/preventAI/types';
import type {Sensitivity} from 'sentry/views/prevent/preventAI/types';

import {useUpdatePreventAIFeature} from './useUpdatePreventAIFeature';

describe('useUpdatePreventAIFeature', () => {
  const orgName = 'org-1';
  const repoName = 'repo-1';

  beforeEach(() => {
    localStorageWrapper.clear();
    jest.clearAllMocks();
  });

  it('returns an object with enableFeature and isLoading properties', () => {
    const {result} = renderHook(() => useUpdatePreventAIFeature(orgName, repoName));
    expect(typeof result.current.enableFeature).toBe('function');
    expect(typeof result.current.isLoading).toBe('boolean');
    expect(typeof result.current.error).toBe('object');
  });

  it('should enable a feature without sensitivity', async () => {
    const {result} = renderHook(() => useUpdatePreventAIFeature(orgName, repoName));

    const response = await result.current.enableFeature({
      feature: 'vanilla',
      enabled: true,
    });

    expect(response.success).toBe(true);
    expect(response.feature).toBe('vanilla');
    expect(response.enabled).toBe(true);
    expect(response.sensitivity).toBeUndefined();

    // Check localStorage
    const storedConfig = JSON.parse(
      localStorageWrapper.getItem(`prevent-ai-config-${orgName}-${repoName}`) || '{}'
    );
    expect(storedConfig.features.vanilla.enabled).toBe(true);
    expect(storedConfig.features.vanilla.sensitivity).toBeUndefined();
  });

  it('should enable a feature with sensitivity', async () => {
    const {result} = renderHook(() => useUpdatePreventAIFeature(orgName, repoName));

    const sensitivity: Sensitivity = 'high';
    const response = await result.current.enableFeature({
      feature: 'vanilla',
      enabled: true,
      sensitivity,
    });

    expect(response.success).toBe(true);
    expect(response.feature).toBe('vanilla');
    expect(response.enabled).toBe(true);
    expect(response.sensitivity).toBe('high');

    // Check localStorage
    const storedConfig = JSON.parse(
      localStorageWrapper.getItem(`prevent-ai-config-${orgName}-${repoName}`) || '{}'
    );
    expect(storedConfig.features.vanilla.enabled).toBe(true);
    expect(storedConfig.features.vanilla.sensitivity).toBe('high');
  });

  it('should enable bug_prediction feature with triggers and sensitivity', async () => {
    const {result} = renderHook(() => useUpdatePreventAIFeature(orgName, repoName));

    const triggers = {
      on_ready_for_review: true,
      on_command_phrase: false,
    };
    const sensitivity: Sensitivity = 'medium';

    const response = await result.current.enableFeature({
      feature: 'bug_prediction',
      enabled: true,
      triggers,
      sensitivity,
    });

    expect(response.success).toBe(true);
    expect(response.feature).toBe('bug_prediction');
    expect(response.enabled).toBe(true);
    expect(response.triggers).toEqual(triggers);
    expect(response.sensitivity).toBe('medium');

    // Check localStorage
    const storedConfig = JSON.parse(
      localStorageWrapper.getItem(`prevent-ai-config-${orgName}-${repoName}`) || '{}'
    );
    expect(storedConfig.features.bug_prediction.enabled).toBe(true);
    expect(storedConfig.features.bug_prediction.triggers).toEqual(triggers);
    expect(storedConfig.features.bug_prediction.sensitivity).toBe('medium');
  });

  it('should update existing config with sensitivity', async () => {
    // Set up existing config
    const existingConfig: PreventAIConfig = {
      features: {
        vanilla: {enabled: true, sensitivity: 'low'},
        test_generation: {enabled: false},
        bug_prediction: {
          enabled: true,
          sensitivity: 'high',
          triggers: {
            on_command_phrase: true,
            on_ready_for_review: false,
          },
        },
      },
    };
    localStorageWrapper.setItem(
      `prevent-ai-config-${orgName}-${repoName}`,
      JSON.stringify(existingConfig)
    );

    const {result} = renderHook(() => useUpdatePreventAIFeature(orgName, repoName));

    // Update vanilla feature sensitivity
    await result.current.enableFeature({
      feature: 'vanilla',
      enabled: true,
      sensitivity: 'critical',
    });

    // Check localStorage - should preserve other features
    const storedConfig = JSON.parse(
      localStorageWrapper.getItem(`prevent-ai-config-${orgName}-${repoName}`) || '{}'
    );
    expect(storedConfig.features.vanilla.enabled).toBe(true);
    expect(storedConfig.features.vanilla.sensitivity).toBe('critical');
    expect(storedConfig.features.test_generation.enabled).toBe(false);
    expect(storedConfig.features.bug_prediction.enabled).toBe(true);
    expect(storedConfig.features.bug_prediction.sensitivity).toBe('high');
  });

  it('should use default storage key when orgName or repoName is not provided', async () => {
    const {result} = renderHook(() => useUpdatePreventAIFeature());

    await result.current.enableFeature({
      feature: 'vanilla',
      enabled: true,
      sensitivity: 'medium',
    });

    // Check default storage key
    const storedConfig = JSON.parse(
      localStorageWrapper.getItem('prevent-ai-config-default') || '{}'
    );
    expect(storedConfig.features.vanilla.enabled).toBe(true);
    expect(storedConfig.features.vanilla.sensitivity).toBe('medium');
  });

  it('should handle all sensitivity values correctly', async () => {
    const {result} = renderHook(() => useUpdatePreventAIFeature(orgName, repoName));
    const sensitivityValues: Sensitivity[] = ['low', 'medium', 'high', 'critical'];

    for (const sensitivity of sensitivityValues) {
      await result.current.enableFeature({
        feature: 'vanilla',
        enabled: true,
        sensitivity,
      });

      const storedConfig = JSON.parse(
        localStorageWrapper.getItem(`prevent-ai-config-${orgName}-${repoName}`) || '{}'
      );
      expect(storedConfig.features.vanilla.sensitivity).toBe(sensitivity);
    }
  });

  it('should handle localStorage errors gracefully', async () => {
    const spy = jest.spyOn(localStorageWrapper, 'getItem').mockImplementation(() => {
      throw new Error('localStorage error');
    });

    const {result} = renderHook(() => useUpdatePreventAIFeature(orgName, repoName));

    // Should still work and create default config
    const response = await result.current.enableFeature({
      feature: 'vanilla',
      enabled: true,
      sensitivity: 'medium',
    });

    expect(response.success).toBe(true);
    spy.mockRestore();
  });
});
