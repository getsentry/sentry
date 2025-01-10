import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {OnboardingContextProvider} from 'sentry/components/onboarding/onboardingContext';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {OnboardingRecentCreatedProject} from 'sentry/types/onboarding';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import SetupDocs from 'sentry/views/onboarding/setupDocs';

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
    url: `/projects/${orgSlug}/${project.slug}/issues/`,
    body: [],
  });

  MockApiClient.addMockResponse({
    url: `/organizations/${orgSlug}/sdks/`,
    body: {
      'sentry.java.android.gradle-plugin': {
        canonical: 'maven:io.sentry:sentry',
        main_docs_url: 'https://docs.sentry.io/platforms/java',
        name: 'io.sentry:sentry',
        package_url: 'https://search.maven.org/artifact/io.sentry/sentry',
        repo_url: 'https://github.com/getsentry/sentry-java',
        version: '3.12.0',
      },
    },
  });
}

describe('Onboarding Setup Docs', function () {
  it('does not render Product Selection', async function () {
    const {router, organization, project} = initializeOrg({
      projects: [
        {
          ...initializeOrg().project,
          slug: 'python',
          platform: 'python',
        },
      ],
    });

    ProjectsStore.init();
    ProjectsStore.loadInitialData([project]);

    renderMockRequests({project, orgSlug: organization.slug});

    render(
      <OnboardingContextProvider>
        <SetupDocs
          active
          onComplete={() => {}}
          stepIndex={2}
          router={router}
          route={{}}
          location={router.location}
          genSkipOnboardingLink={() => ''}
          orgId={organization.slug}
          search=""
          recentCreatedProject={project as OnboardingRecentCreatedProject}
        />
      </OnboardingContextProvider>,
      {
        router,
        organization,
      }
    );

    expect(
      await screen.findByRole('heading', {name: 'Configure Python SDK'})
    ).toBeInTheDocument();

    expect(
      screen.queryByTestId(
        `product-${ProductSolution.ERROR_MONITORING}-${ProductSolution.PERFORMANCE_MONITORING}-${ProductSolution.SESSION_REPLAY}`
      )
    ).not.toBeInTheDocument();
  });

  it('renders SDK version from the sentry release registry', async function () {
    const {router, organization, project} = initializeOrg({
      projects: [
        {
          ...initializeOrg().project,
          slug: 'java',
          platform: 'java',
        },
      ],
    });

    ProjectsStore.init();
    ProjectsStore.loadInitialData([project]);

    renderMockRequests({project, orgSlug: organization.slug});

    render(
      <OnboardingContextProvider>
        <SetupDocs
          active
          onComplete={() => {}}
          stepIndex={2}
          router={router}
          route={{}}
          location={router.location}
          genSkipOnboardingLink={() => ''}
          orgId={organization.slug}
          search=""
          recentCreatedProject={project as OnboardingRecentCreatedProject}
        />
      </OnboardingContextProvider>,
      {
        router,
        organization,
      }
    );

    expect(
      await screen.findByText(/id "io.sentry.jvm.gradle" version "3.12.0"/)
    ).toBeInTheDocument();
  });

  describe('renders Product Selection', function () {
    it('all products checked', async function () {
      const {router, organization, project} = initializeOrg({
        router: {
          location: {
            query: {
              product: [
                ProductSolution.PERFORMANCE_MONITORING,
                ProductSolution.SESSION_REPLAY,
              ],
            },
          },
        },
        projects: [
          {
            ...initializeOrg().project,
            slug: 'javascript-react',
            platform: 'javascript-react',
          },
        ],
      });

      ProjectsStore.init();
      ProjectsStore.loadInitialData([project]);

      renderMockRequests({
        project,
        orgSlug: organization.slug,
      });

      render(
        <OnboardingContextProvider>
          <SetupDocs
            active
            onComplete={() => {}}
            stepIndex={2}
            router={router}
            route={{}}
            location={router.location}
            genSkipOnboardingLink={() => ''}
            orgId={organization.slug}
            search=""
            recentCreatedProject={project as OnboardingRecentCreatedProject}
          />
        </OnboardingContextProvider>,
        {
          router,
          organization,
        }
      );

      expect(
        await screen.findByRole('heading', {name: 'Configure React SDK'})
      ).toBeInTheDocument();

      const codeBlock = await screen.findByText(/import \* as Sentry/);
      expect(codeBlock).toHaveTextContent(/Tracing/);
      expect(codeBlock).toHaveTextContent(/Session Replay/);
    });

    it('only performance checked', async function () {
      const {router, organization, project} = initializeOrg({
        router: {
          location: {
            query: {product: [ProductSolution.PERFORMANCE_MONITORING]},
          },
        },
        projects: [
          {
            ...initializeOrg().project,
            slug: 'javascript-react',
            platform: 'javascript-react',
          },
        ],
      });

      ProjectsStore.init();
      ProjectsStore.loadInitialData([project]);

      renderMockRequests({
        project,
        orgSlug: organization.slug,
      });

      render(
        <OnboardingContextProvider>
          <SetupDocs
            active
            onComplete={() => {}}
            stepIndex={2}
            router={router}
            route={{}}
            location={router.location}
            genSkipOnboardingLink={() => ''}
            orgId={organization.slug}
            search=""
            recentCreatedProject={project as OnboardingRecentCreatedProject}
          />
        </OnboardingContextProvider>,
        {
          router,
          organization,
        }
      );

      const codeBlock = await screen.findByText(/import \* as Sentry/);
      expect(codeBlock).toHaveTextContent(/Tracing/);
      expect(codeBlock).not.toHaveTextContent(/Session Replay/);
    });

    it('only session replay checked', async function () {
      const {router, organization, project} = initializeOrg({
        router: {
          location: {
            query: {product: [ProductSolution.SESSION_REPLAY]},
          },
        },
        projects: [
          {
            ...initializeOrg().project,
            slug: 'javascript-react',
            platform: 'javascript-react',
          },
        ],
      });

      ProjectsStore.init();
      ProjectsStore.loadInitialData([project]);

      renderMockRequests({
        project,
        orgSlug: organization.slug,
      });

      render(
        <OnboardingContextProvider>
          <SetupDocs
            active
            onComplete={() => {}}
            stepIndex={2}
            router={router}
            route={{}}
            location={router.location}
            genSkipOnboardingLink={() => ''}
            orgId={organization.slug}
            search=""
            recentCreatedProject={project as OnboardingRecentCreatedProject}
          />
        </OnboardingContextProvider>,
        {
          router,
          organization,
        }
      );

      const codeBlock = await screen.findByText(/import \* as Sentry/);
      expect(codeBlock).toHaveTextContent(/Session Replay/);
      expect(codeBlock).not.toHaveTextContent(/Tracing/);
    });

    it('only error monitoring checked', async function () {
      const {router, organization, project} = initializeOrg({
        router: {
          location: {
            query: {product: []},
          },
        },
        projects: [
          {
            ...initializeOrg().project,
            slug: 'javascript-react',
            platform: 'javascript-react',
          },
        ],
      });

      ProjectsStore.init();
      ProjectsStore.loadInitialData([project]);

      renderMockRequests({
        project,
        orgSlug: organization.slug,
      });

      render(
        <OnboardingContextProvider>
          <SetupDocs
            active
            onComplete={() => {}}
            stepIndex={2}
            router={router}
            route={{}}
            location={router.location}
            genSkipOnboardingLink={() => ''}
            orgId={organization.slug}
            search=""
            recentCreatedProject={project as OnboardingRecentCreatedProject}
          />
        </OnboardingContextProvider>,
        {
          router,
          organization,
        }
      );

      await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

      const codeBlock = await screen.findByText(/import \* as Sentry/);
      expect(codeBlock).not.toHaveTextContent(/Tracing/);
      expect(codeBlock).not.toHaveTextContent(/Session Replay/);
    });
  });

  describe('JS Loader Script', function () {
    it('renders Loader Script setup', async function () {
      const {router, organization, project} = initializeOrg({
        router: {
          location: {
            query: {
              product: [
                ProductSolution.PERFORMANCE_MONITORING,
                ProductSolution.SESSION_REPLAY,
              ],
              installationMode: 'auto',
            },
          },
        },
        projects: [
          {
            ...initializeOrg().project,
            slug: 'javascript',
            platform: 'javascript',
          },
        ],
        organization: OrganizationFixture({
          features: ['session-replay', 'performance-view'],
        }),
      });

      const updateLoaderMock = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/keys/${PROJECT_KEY!.id}/`,
        method: 'PUT',
        body: PROJECT_KEY,
      });

      ProjectsStore.init();
      ProjectsStore.loadInitialData([project]);

      renderMockRequests({
        project,
        orgSlug: organization.slug,
      });

      render(
        <OnboardingContextProvider>
          <SetupDocs
            active
            onComplete={() => {}}
            stepIndex={2}
            router={router}
            route={{}}
            location={router.location}
            genSkipOnboardingLink={() => ''}
            orgId={organization.slug}
            search=""
            recentCreatedProject={project as OnboardingRecentCreatedProject}
          />
        </OnboardingContextProvider>,
        {
          router,
          organization,
        }
      );

      expect(
        await screen.findByRole('radio', {name: 'Loader Script'})
      ).toBeInTheDocument();

      expect(updateLoaderMock).toHaveBeenCalledTimes(1);
      expect(updateLoaderMock).toHaveBeenCalledWith(
        expect.any(String), // The URL
        {
          data: {
            dynamicSdkLoaderOptions: {
              hasDebug: false,
              hasPerformance: true,
              hasReplay: true,
            },
          },
          error: expect.any(Function),
          method: 'PUT',
          success: expect.any(Function),
        }
      );

      expect(
        await screen.findByRole('radio', {name: 'Loader Script'})
      ).toBeInTheDocument();

      await userEvent.click(screen.getByRole('checkbox', {name: 'Session Replay'}));
      expect(updateLoaderMock).toHaveBeenCalledTimes(2);

      expect(updateLoaderMock).toHaveBeenLastCalledWith(
        expect.any(String), // The URL
        {
          data: {
            dynamicSdkLoaderOptions: {
              hasDebug: false,
              hasPerformance: true,
              hasReplay: false,
            },
          },
          error: expect.any(Function),
          method: 'PUT',
          success: expect.any(Function),
        }
      );
    });
  });

  describe('special platforms', () => {
    it('renders platform other', async function () {
      const {router, organization, project} = initializeOrg({
        projects: [
          {
            ...initializeOrg().project,
            slug: 'other',
            platform: 'other',
          },
        ],
      });

      ProjectsStore.init();
      ProjectsStore.loadInitialData([project]);

      renderMockRequests({project, orgSlug: organization.slug});

      render(
        <OnboardingContextProvider>
          <SetupDocs
            active
            onComplete={() => {}}
            stepIndex={2}
            router={router}
            route={{}}
            location={router.location}
            genSkipOnboardingLink={() => ''}
            orgId={organization.slug}
            search=""
            recentCreatedProject={project as OnboardingRecentCreatedProject}
          />
        </OnboardingContextProvider>,
        {
          router,
          organization,
        }
      );

      expect(
        await screen.findByRole('heading', {name: 'Configure Other SDK'})
      ).toBeInTheDocument();
    });
  });
});
