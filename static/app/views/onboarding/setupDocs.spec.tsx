import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {
  render,
  screen,
  userEvent,
  waitForElementToBeRemoved,
} from 'sentry-test/reactTestingLibrary';

import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {OnboardingContextProvider} from 'sentry/components/onboarding/onboardingContext';
import ProjectsStore from 'sentry/stores/projectsStore';
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

describe('Onboarding Setup Docs', () => {
  it('does not render Product Selection', async () => {
    const organization = OrganizationFixture();
    const project = ProjectFixture({
      slug: 'python',
      platform: 'python',
    });

    ProjectsStore.init();
    ProjectsStore.loadInitialData([project]);

    renderMockRequests({project, orgSlug: organization.slug});

    render(
      <OnboardingContextProvider>
        <SetupDocs
          onComplete={() => {}}
          stepIndex={2}
          genSkipOnboardingLink={() => ''}
          recentCreatedProject={project}
        />
      </OnboardingContextProvider>
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

  it('renders SDK version from the sentry release registry', async () => {
    const organization = OrganizationFixture();
    const project = ProjectFixture({
      slug: 'java',
      platform: 'java',
    });

    ProjectsStore.init();
    ProjectsStore.loadInitialData([project]);

    renderMockRequests({project, orgSlug: organization.slug});

    render(
      <OnboardingContextProvider>
        <SetupDocs
          onComplete={() => {}}
          stepIndex={2}
          genSkipOnboardingLink={() => ''}
          recentCreatedProject={project}
        />
      </OnboardingContextProvider>
    );

    expect(
      await screen.findByText(/id "io.sentry.jvm.gradle" version "3.12.0"/)
    ).toBeInTheDocument();
  });

  describe('renders Product Selection', () => {
    it('all products checked', async () => {
      const organization = OrganizationFixture();
      const project = ProjectFixture({
        slug: 'javascript-react',
        platform: 'javascript-react',
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
            onComplete={() => {}}
            stepIndex={2}
            genSkipOnboardingLink={() => ''}
            recentCreatedProject={project}
          />
        </OnboardingContextProvider>,
        {
          initialRouterConfig: {
            location: {
              pathname: `/onboarding/${organization.slug}/setup-docs/`,
              query: {
                product: [
                  ProductSolution.PERFORMANCE_MONITORING,
                  ProductSolution.SESSION_REPLAY,
                ],
              },
            },
            route: `/onboarding/:orgId/setup-docs/`,
          },
        }
      );

      expect(
        await screen.findByRole('heading', {name: 'Configure React SDK'})
      ).toBeInTheDocument();

      // First code block is the install snippet, second is the verify snippet
      const codeBlocks = await screen.findAllByText(/import \* as Sentry/);
      expect(codeBlocks[0]).toHaveTextContent(/Tracing/);
      expect(codeBlocks[0]).toHaveTextContent(/Session Replay/);
    });

    it('only performance checked', async () => {
      const organization = OrganizationFixture();
      const project = ProjectFixture({
        slug: 'javascript-react',
        platform: 'javascript-react',
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
            onComplete={() => {}}
            stepIndex={2}
            genSkipOnboardingLink={() => ''}
            recentCreatedProject={project}
          />
        </OnboardingContextProvider>,
        {
          initialRouterConfig: {
            location: {
              pathname: `/onboarding/${organization.slug}/setup-docs/`,
              query: {product: [ProductSolution.PERFORMANCE_MONITORING]},
            },
            route: `/onboarding/:orgId/setup-docs/`,
          },
        }
      );

      // First code block is the install snippet, second is the verify snippet
      const codeBlocks = await screen.findAllByText(/import \* as Sentry/);
      expect(codeBlocks[0]).toHaveTextContent(/Tracing/);
      expect(codeBlocks[0]).not.toHaveTextContent(/Session Replay/);
    });

    it('only session replay checked', async () => {
      const organization = OrganizationFixture();
      const project = ProjectFixture({
        slug: 'javascript-react',
        platform: 'javascript-react',
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
            onComplete={() => {}}
            stepIndex={2}
            genSkipOnboardingLink={() => ''}
            recentCreatedProject={project}
          />
        </OnboardingContextProvider>,
        {
          initialRouterConfig: {
            location: {
              pathname: `/onboarding/${organization.slug}/setup-docs/`,
              query: {product: [ProductSolution.SESSION_REPLAY]},
            },
            route: `/onboarding/:orgId/setup-docs/`,
          },
        }
      );

      // First code block is the install snippet, second is the verify snippet
      const codeBlocks = await screen.findAllByText(/import \* as Sentry/);
      expect(codeBlocks[0]).toHaveTextContent(/Session Replay/);
      expect(codeBlocks[0]).not.toHaveTextContent(/Tracing/);
    });

    it('only error monitoring checked', async () => {
      const organization = OrganizationFixture();
      const project = ProjectFixture({
        slug: 'javascript-react',
        platform: 'javascript-react',
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
            onComplete={() => {}}
            stepIndex={2}
            genSkipOnboardingLink={() => ''}
            recentCreatedProject={project}
          />
        </OnboardingContextProvider>,
        {
          initialRouterConfig: {
            location: {
              pathname: `/onboarding/${organization.slug}/setup-docs/`,
              query: {product: []},
            },
            route: `/onboarding/:orgId/setup-docs/`,
          },
        }
      );

      await waitForElementToBeRemoved(() => screen.queryByTestId('loading-indicator'));

      // First code block is the install snippet, second is the verify snippet
      const codeBlocks = await screen.findAllByText(/import \* as Sentry/);
      expect(codeBlocks[0]).not.toHaveTextContent(/Tracing/);
      expect(codeBlocks[0]).not.toHaveTextContent(/Session Replay/);
    });
  });

  describe('JS Loader Script', () => {
    it('renders Loader Script setup', async () => {
      const organization = OrganizationFixture({
        features: ['session-replay', 'performance-view'],
      });
      const project = ProjectFixture({
        slug: 'javascript',
        platform: 'javascript',
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
            onComplete={() => {}}
            stepIndex={2}
            genSkipOnboardingLink={() => ''}
            recentCreatedProject={project}
          />
        </OnboardingContextProvider>,
        {
          organization,
          initialRouterConfig: {
            location: {
              pathname: `/onboarding/${organization.slug}/setup-docs/`,
              query: {
                product: [
                  ProductSolution.PERFORMANCE_MONITORING,
                  ProductSolution.SESSION_REPLAY,
                ],
                installationMode: 'auto',
              },
            },
            route: `/onboarding/:orgId/setup-docs/`,
          },
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

      await userEvent.click(screen.getByRole('button', {name: 'Session Replay'}));
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
    it('renders platform other', async () => {
      const organization = OrganizationFixture();
      const project = ProjectFixture({
        slug: 'other',
        platform: 'other',
      });

      ProjectsStore.init();
      ProjectsStore.loadInitialData([project]);

      renderMockRequests({project, orgSlug: organization.slug});

      render(
        <OnboardingContextProvider>
          <SetupDocs
            onComplete={() => {}}
            stepIndex={2}
            genSkipOnboardingLink={() => ''}
            recentCreatedProject={project}
          />
        </OnboardingContextProvider>
      );

      expect(
        await screen.findByRole('heading', {name: 'Configure Other SDK'})
      ).toBeInTheDocument();
    });
  });
});
