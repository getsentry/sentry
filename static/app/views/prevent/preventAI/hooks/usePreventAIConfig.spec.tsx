import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {PREVENT_AI_CONFIG_SCHEMA_VERSION_DEFAULT} from 'sentry/types/prevent';

import {usePreventAIGitHubConfig} from './usePreventAIConfig';

describe('usePreventAIGitHubConfig', () => {
  const org = OrganizationFixture({slug: 'test-org'});
  const gitOrgName = 'octo-corp';

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('fetches config from API correctly', async () => {
    const configResponse = {
      default_org_config: {
        org_defaults: {
          vanilla: {enabled: true, sensitivity: 'medium'},
          test_generation: {enabled: false, sensitivity: 'low'},
          bug_prediction: {enabled: false, sensitivity: 'high'},
        },
        repo_overrides: {
          'repo-123': {
            vanilla: {enabled: false, sensitivity: 'high'},
            test_generation: {enabled: true, sensitivity: 'critical'},
            bug_prediction: {enabled: false, sensitivity: 'medium'},
          },
        },
        schema_version: PREVENT_AI_CONFIG_SCHEMA_VERSION_DEFAULT,
      },
      organization: {
        org_defaults: {
          vanilla: {enabled: false, sensitivity: 'low'},
          test_generation: {enabled: true, sensitivity: 'medium'},
          bug_prediction: {enabled: true, sensitivity: 'high'},
        },
        repo_overrides: {},
        schema_version: PREVENT_AI_CONFIG_SCHEMA_VERSION_DEFAULT,
      },
      schema_version: PREVENT_AI_CONFIG_SCHEMA_VERSION_DEFAULT,
    };

    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/prevent/ai/github/config/${gitOrgName}/`,
      body: configResponse,
    });

    const {result} = renderHookWithProviders(
      () => usePreventAIGitHubConfig({gitOrgName}),
      {
        organization: org,
      }
    );

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.data).toMatchObject(configResponse);
    expect(result.current.isError).toBeFalsy();
  });

  it('sets isError when API fails', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${org.slug}/prevent/ai/github/config/${gitOrgName}/`,
      statusCode: 500,
    });

    const {result} = renderHookWithProviders(
      () => usePreventAIGitHubConfig({gitOrgName}),
      {
        organization: org,
      }
    );

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.isError).toBe(true);
    expect(result.current.data).toBeUndefined();
  });

  it('uses correct API URL for different org', async () => {
    const diffOrg = OrganizationFixture({slug: 'diff-org'});

    MockApiClient.addMockResponse({
      url: `/organizations/diff-org/prevent/ai/github/config/${gitOrgName}/`,
      body: {},
    });

    const {result} = renderHookWithProviders(
      () => usePreventAIGitHubConfig({gitOrgName}),
      {
        organization: diffOrg,
      }
    );

    await waitFor(() => {
      expect(result.current.isPending).toBe(false);
    });

    expect(result.current.isError).toBeFalsy();
  });
});
