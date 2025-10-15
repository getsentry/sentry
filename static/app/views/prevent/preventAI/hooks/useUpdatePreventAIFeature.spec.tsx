import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import * as organizationsActionCreator from 'sentry/actionCreators/organizations';

import {
  makePreventAIConfig,
  useUpdatePreventAIFeature,
} from './useUpdatePreventAIFeature';

describe('useUpdatePreventAIFeature', () => {
  const mockOrg = OrganizationFixture({
    slug: 'test-sentry-slug',
    preventAiConfigGithub: {
      schema_version: 'v1',
      github_organizations: {
        'org-1': {
          org_defaults: {
            vanilla: {
              enabled: false,
              triggers: {on_command_phrase: false, on_ready_for_review: false},
              sensitivity: 'medium',
            },
            test_generation: {
              enabled: false,
              triggers: {on_command_phrase: false, on_ready_for_review: false},
            },
            bug_prediction: {
              enabled: false,
              triggers: {on_command_phrase: false, on_ready_for_review: false},
              sensitivity: 'medium',
            },
          },
          repo_overrides: {},
        },
      },
      default_org_config: {
        org_defaults: {
          vanilla: {
            enabled: false,
            triggers: {on_command_phrase: false, on_ready_for_review: false},
            sensitivity: 'medium',
          },
          test_generation: {
            enabled: false,
            triggers: {on_command_phrase: false, on_ready_for_review: false},
          },
          bug_prediction: {
            enabled: false,
            triggers: {on_command_phrase: false, on_ready_for_review: false},
            sensitivity: 'medium',
          },
        },
        repo_overrides: {},
      },
    },
  });

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    jest
      .spyOn(organizationsActionCreator, 'updateOrganization')
      .mockImplementation(() => {});
  });

  it('calls API with correct params to enable a feature', async () => {
    const mockResponse = MockApiClient.addMockResponse({
      url: `/organizations/${mockOrg.slug}/`,
      method: 'PUT',
      body: {preventAiConfigGithub: mockOrg.preventAiConfigGithub},
    });
    const {result} = renderHookWithProviders(() => useUpdatePreventAIFeature(), {
      organization: mockOrg,
    });

    result.current.enableFeature({
      feature: 'vanilla',
      enabled: true,
      orgName: 'org-1',
      repoName: 'repo-1',
      trigger: {on_command_phrase: true},
    });

    await waitFor(() => {
      expect(mockResponse).toHaveBeenCalled();
    });
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeUndefined();
  });

  it('sets error if API call fails', async () => {
    const mockResponse = MockApiClient.addMockResponse({
      url: `/organizations/${mockOrg.slug}/`,
      method: 'PUT',
      statusCode: 400,
      body: {detail: 'fail'},
    });

    const {result} = renderHookWithProviders(() => useUpdatePreventAIFeature(), {
      organization: mockOrg,
    });

    await expect(
      result.current.enableFeature({
        feature: 'vanilla',
        enabled: true,
        orgName: 'org-1',
        repoName: 'repo-1',
        trigger: {on_command_phrase: true},
      })
    ).rejects.toBeDefined();

    await waitFor(() => {
      expect(mockResponse).toHaveBeenCalled();
    });
    expect(result.current.error).toBeDefined();
    expect(result.current.isLoading).toBe(false);
  });

  it('throws if organization has no prevent AI config', async () => {
    const orgNoConfig = {
      ...OrganizationFixture(),
      preventAiConfigGithub: undefined,
    };
    const {result} = renderHookWithProviders(() => useUpdatePreventAIFeature(), {
      organization: orgNoConfig,
    });

    await expect(
      result.current.enableFeature({
        feature: 'vanilla',
        enabled: true,
        orgName: 'org-1',
        repoName: 'repo-1',
      })
    ).rejects.toThrow('Organization has no AI Code Review config');
  });

  describe('makePreventAIConfig', () => {
    it('should update the correct feature config in org_defaults', () => {
      const config = structuredClone(mockOrg.preventAiConfigGithub!);
      const updatedConfig = makePreventAIConfig(config, {
        feature: 'vanilla',
        enabled: true,
        orgName: 'org-1',
      });
      expect(
        updatedConfig.github_organizations?.['org-1']?.org_defaults?.vanilla?.enabled
      ).toBe(true);
      // Should not mutate original
      expect(config.github_organizations?.['org-1']?.org_defaults?.vanilla?.enabled).toBe(
        false
      );
    });

    it('should update the correct feature config in repo_overrides', () => {
      const config = structuredClone(mockOrg.preventAiConfigGithub!);
      const updatedConfig = makePreventAIConfig(config, {
        feature: 'test_generation',
        enabled: true,
        orgName: 'org-1',
        repoName: 'repo-123',
        trigger: {on_command_phrase: true},
      });
      expect(
        updatedConfig.github_organizations?.['org-1']?.repo_overrides?.['repo-123']
          ?.test_generation?.enabled
      ).toBe(true);
      expect(
        updatedConfig.github_organizations?.['org-1']?.repo_overrides?.['repo-123']
          ?.test_generation.triggers.on_command_phrase
      ).toBe(true);
      // Should not mutate original
      expect(config.github_organizations?.['org-1']?.repo_overrides).toEqual({});
    });

    it('should merge triggers', () => {
      const config = structuredClone(mockOrg.preventAiConfigGithub!);
      const updatedConfig = makePreventAIConfig(config, {
        feature: 'bug_prediction',
        enabled: false,
        orgName: 'org-1',
        repoName: 'repo-xyz',
        trigger: {on_ready_for_review: true},
      });
      const feature =
        updatedConfig.github_organizations?.['org-1']?.repo_overrides?.['repo-xyz']
          ?.bug_prediction;
      expect(feature?.enabled).toBe(false);
      expect(feature?.triggers.on_ready_for_review).toBe(true);
    });

    it('should update sensitivity', () => {
      const config = structuredClone(mockOrg.preventAiConfigGithub!);
      const updatedConfig = makePreventAIConfig(config, {
        feature: 'bug_prediction',
        enabled: true,
        orgName: 'org-1',
        repoName: 'repo-xyz',
        sensitivity: 'low',
      });
      const feature =
        updatedConfig.github_organizations?.['org-1']?.repo_overrides?.['repo-xyz']
          ?.bug_prediction;
      expect(feature?.sensitivity).toBe('low');
    });
  });
});
