import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {OnboardingContextProvider} from 'sentry/components/onboarding/onboardingContext';

const PROJECT_KEY = ProjectKeysFixture()[0];
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';

import {SdkDocumentation} from './sdkDocumentation';

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
    url: `/organizations/${orgSlug}/sdks/`,
  });
}

describe('Renders SDK Documentation corretly based on platform id and language', function () {
  it('Native QT', async function () {
    const {organization, project} = initializeOrg({
      projects: [
        {
          ...initializeOrg().project,
          slug: 'native-qt',
          platform: 'native-qt',
        },
      ],
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
          projectSlug={project.slug}
          projectId={project.id}
          organization={organization}
          activeProductSelection={[]}
        />
      </OnboardingContextProvider>
    );

    // Renders main headings
    expect(await screen.findByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();
  });

  it('JavaScript', async function () {
    const {organization, project, router} = initializeOrg({
      projects: [
        {
          ...initializeOrg().project,
          slug: 'javascript',
          platform: 'javascript',
        },
      ],
      router: {
        location: {
          query: {
            installationMode: 'manual',
          },
        },
      },
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
          projectSlug={project.slug}
          projectId={project.id}
          organization={organization}
          activeProductSelection={[]}
        />
      </OnboardingContextProvider>,
      {
        router,
      }
    );

    // Renders main headings
    expect(await screen.findByRole('heading', {name: 'Install'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Configure SDK'})).toBeInTheDocument();
    expect(screen.getByRole('heading', {name: 'Verify'})).toBeInTheDocument();
  });
});
