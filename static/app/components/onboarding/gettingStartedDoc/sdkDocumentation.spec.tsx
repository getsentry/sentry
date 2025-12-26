import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {OnboardingContextProvider} from 'sentry/components/onboarding/onboardingContext';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

import {SdkDocumentation} from './sdkDocumentation';

const PROJECT_KEY = ProjectKeysFixture()[0];

function renderMockRequests({
  project,
  orgSlug,
}: {
  orgSlug: Organization['slug'];
  project: Project;
}) {
  MockApiClient.addMockResponse({
    url: `/projects/${orgSlug}/${project.slug}/`,
    body: project,
  });

  MockApiClient.addMockResponse({
    url: `/projects/${orgSlug}/${project.slug}/keys/`,
    body: [PROJECT_KEY],
  });

  MockApiClient.addMockResponse({
    url: `/projects/${orgSlug}/${project.slug}/keys/${PROJECT_KEY?.id}/`,
    method: 'PUT',
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${orgSlug}/sdks/`,
  });
}

describe('Renders SDK Documentation corretly based on platform id and language', () => {
  it('Native QT', async () => {
    const organization = OrganizationFixture();
    const project = ProjectFixture({
      slug: 'native-qt',
      platform: 'native-qt',
    });

    renderMockRequests({project, orgSlug: organization.slug});

    render(
      <OnboardingContextProvider>
        <SdkDocumentation
          platform={{
            id: 'native-qt',
            name: 'Qt',
            type: 'framework',
            language: 'native',
            link: 'https://docs.sentry.io/platforms/native/guides/qt/',
          }}
          project={project}
          organization={organization}
          activeProductSelection={[]}
        />
      </OnboardingContextProvider>,
      {organization}
    );

    // Renders main headings
    expect(await screen.findByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();
  });

  it('JavaScript', async () => {
    const organization = OrganizationFixture();
    const project = ProjectFixture({
      slug: 'javascript',
      platform: 'javascript',
    });

    renderMockRequests({project, orgSlug: organization.slug});

    render(
      <OnboardingContextProvider>
        <SdkDocumentation
          platform={{
            id: 'javascript',
            name: 'Browser JavaScript',
            type: 'language',
            language: 'javascript',
            link: 'https://docs.sentry.io/platforms/javascript/',
          }}
          project={project}
          organization={organization}
          activeProductSelection={[]}
        />
      </OnboardingContextProvider>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/',
            query: {installationMode: 'manual'},
          },
        },
      }
    );

    // Renders main headings
    expect(await screen.findByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();
  });
});
