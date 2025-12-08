import {OrganizationFixture} from 'sentry-fixture/organization';
import {PreventAIConfigFixture} from 'sentry-fixture/prevent';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import type {PreventAIConfig} from 'sentry/types/prevent';

import {
  makePreventAIConfig,
  useUpdatePreventAIFeature,
} from './useUpdatePreventAIFeature';

describe('useUpdatePreventAIFeature', () => {
  const organization = OrganizationFixture();
  const config = PreventAIConfigFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest.resetAllMocks();
  });

  it('enables a feature successfully via API', async () => {
    const mockResp = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prevent/ai/github/config/org-1/`,
      method: 'PUT',
      body: config,
    });

    const {result} = renderHookWithProviders(() => useUpdatePreventAIFeature(), {
      organization,
    });

    result.current.enableFeature({
      feature: 'vanilla',
      enabled: true,
      gitOrgName: 'org-1',
      originalConfig: config,
      repoId: 'repo-1',
      trigger: {on_command_phrase: true},
    });

    await waitFor(() => {
      expect(mockResp).toHaveBeenCalled();
    });

    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  it('sets error if API call fails', async () => {
    const mockResp = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/prevent/ai/github/config/org-1/`,
      method: 'PUT',
      statusCode: 400,
      body: {detail: 'fail'},
    });

    const {result} = renderHookWithProviders(() => useUpdatePreventAIFeature(), {
      organization,
    });

    await expect(
      result.current.enableFeature({
        feature: 'vanilla',
        enabled: true,
        gitOrgName: 'org-1',
        originalConfig: config,
        repoId: 'repo-1',
        trigger: {on_command_phrase: true},
      })
    ).rejects.toBeDefined();

    await waitFor(() => {
      expect(mockResp).toHaveBeenCalled();
    });
    expect(result.current.error).toBeDefined();
    expect(result.current.isLoading).toBe(false);
  });

  describe('makePreventAIConfig', () => {
    it('updates org_defaults feature config', () => {
      const original = structuredClone(config);
      const updated = makePreventAIConfig(original, {
        feature: 'vanilla',
        enabled: true,
        gitOrgName: 'org-1',
        originalConfig: config,
      });
      expect(updated.org_defaults?.vanilla?.enabled).toBe(true);
      expect(original.org_defaults?.vanilla?.enabled).toBe(false);
    });

    it('updates repo_overrides feature config', () => {
      const original = structuredClone(config);
      const updated = makePreventAIConfig(original, {
        feature: 'test_generation',
        enabled: true,
        gitOrgName: 'org-1',
        originalConfig: config,
        repoId: 'repo-123',
        trigger: {on_command_phrase: true},
      });
      expect(updated.repo_overrides?.['repo-123']?.test_generation?.enabled).toBe(true);
      expect(
        updated.repo_overrides?.['repo-123']?.test_generation.triggers.on_command_phrase
      ).toBe(true);
      expect(original.repo_overrides).toEqual({});
    });

    it('merges triggers', () => {
      const original = structuredClone(config);
      const updated = makePreventAIConfig(original, {
        feature: 'bug_prediction',
        enabled: false,
        gitOrgName: 'org-1',
        originalConfig: config,
        repoId: 'repo-xyz',
        trigger: {on_ready_for_review: true},
      });
      const feature = updated.repo_overrides?.['repo-xyz']?.bug_prediction;
      expect(feature?.enabled).toBe(false);
      expect(feature?.triggers.on_ready_for_review).toBe(true);
    });

    it('updates sensitivity', () => {
      const original = structuredClone(config);
      const updated = makePreventAIConfig(original, {
        feature: 'bug_prediction',
        enabled: true,
        gitOrgName: 'org-1',
        originalConfig: config,
        repoId: 'repo-xyz',
        sensitivity: 'low',
      });
      const feature = updated.repo_overrides?.['repo-xyz']?.bug_prediction;
      expect(feature?.sensitivity).toBe('low');
    });

    it('deletes repo override when use_org_defaults is enabled', () => {
      const localConfig = structuredClone(config);
      const configWithOverride: PreventAIConfig = {
        ...config,
        repo_overrides: {
          'repo-123': {
            vanilla: {
              enabled: true,
              triggers: {
                on_command_phrase: true,
                on_ready_for_review: false,
                on_new_commit: false,
              },
              sensitivity: 'high',
            },
            bug_prediction: {
              enabled: true,
              triggers: {
                on_command_phrase: true,
                on_ready_for_review: false,
                on_new_commit: false,
              },
              sensitivity: 'high',
            },
            test_generation: {
              enabled: true,
              triggers: {
                on_command_phrase: true,
                on_ready_for_review: false,
                on_new_commit: false,
              },
            },
          },
        },
      };

      const updated = makePreventAIConfig(localConfig, {
        feature: 'use_org_defaults',
        enabled: true,
        gitOrgName: 'org-1',
        originalConfig: configWithOverride,
        repoId: 'repo-123',
      });

      expect(updated.repo_overrides?.['repo-123']).toBeUndefined();
    });

    it('creates repo override when use_org_defaults is disabled', () => {
      const localConfig = structuredClone(config);
      expect(localConfig.repo_overrides?.['repo-456']).toBeUndefined();

      const updated = makePreventAIConfig(localConfig, {
        feature: 'use_org_defaults',
        enabled: false,
        gitOrgName: 'org-1',
        originalConfig: config,
        repoId: 'repo-456',
      });

      const repoOverride = updated.repo_overrides?.['repo-456'];
      expect(repoOverride).toBeDefined();
      expect(repoOverride).toEqual(updated.org_defaults);
      expect(localConfig.repo_overrides?.['repo-456']).toBeUndefined();
    });

    it('throws if repo name is not provided when use_org_defaults', () => {
      const localConfig = structuredClone(config);
      expect(() =>
        makePreventAIConfig(localConfig, {
          feature: 'use_org_defaults',
          enabled: true,
          gitOrgName: 'org-1',
          originalConfig: config,
        })
      ).toThrow('Repo name is required when feature is use_org_defaults');
    });
  });
});
