import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {useCreateProject} from 'sentry/components/onboarding/useCreateProject';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';

const platform: OnboardingSelectedSDK = {
  key: 'javascript-nextjs',
  language: 'javascript',
  link: 'https://docs.sentry.io/platforms/javascript/guides/nextjs/',
  name: 'Next.js',
  type: 'framework',
  category: 'browser',
};

describe('useCreateProject', () => {
  const organization = OrganizationFixture();
  const project = ProjectFixture({slug: 'my-project'});

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      body: organization,
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/teams/`,
      body: [],
    });
    jest.spyOn(ProjectsStore, 'onCreateSuccess');
  });

  it('POSTs to /organizations/{org}/projects/ when no team slug is given', async () => {
    const mockCreate = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      method: 'POST',
      body: project,
    });

    const {result} = renderHookWithProviders(() => useCreateProject(), {organization});

    result.current.mutate({platform, name: 'my-project'});

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
    expect(ProjectsStore.onCreateSuccess).toHaveBeenCalledWith(
      project,
      organization.slug
    );
  });

  it('POSTs to /teams/{org}/{team}/projects/ when a team slug is provided', async () => {
    const mockCreate = MockApiClient.addMockResponse({
      url: `/teams/${organization.slug}/my-team/projects/`,
      method: 'POST',
      body: project,
    });

    const {result} = renderHookWithProviders(() => useCreateProject(), {organization});

    result.current.mutate({platform, name: 'my-project', firstTeamSlug: 'my-team'});

    await waitFor(() => expect(mockCreate).toHaveBeenCalled());
  });
});
