import {Location} from 'history';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import {OnboardingContextProvider} from 'sentry/components/onboarding/onboardingContext';
import {PRODUCT} from 'sentry/components/onboarding/productSelection';
import ProjectsStore from 'sentry/stores/projectsStore';
import {Organization, Project} from 'sentry/types';
import SetupDocs from 'sentry/views/onboarding/setupDocs';

const PROJECT_KEY = TestStubs.ProjectKeys()[0];

function renderMockRequests({
  project,
  orgSlug,
  location,
}: {
  orgSlug: Organization['slug'];
  project: Project;
  location?: Location;
}) {
  MockApiClient.addMockResponse({
    url: `/projects/${orgSlug}/${project.slug}/`,
    body: project,
  });

  if (project.slug === 'javascript') {
    MockApiClient.addMockResponse({
      url: `/projects/${orgSlug}/${project.slug}/keys/`,
      body: [PROJECT_KEY],
    });
  }

  MockApiClient.addMockResponse({
    url: `/projects/${orgSlug}/${project.slug}/issues/`,
    body: [],
  });

  if (project.slug === 'javascript-react') {
    const products = location?.query.product ?? [];
    if (
      products.includes(PRODUCT.PERFORMANCE_MONITORING) &&
      products.includes(PRODUCT.SESSION_REPLAY)
    ) {
      MockApiClient.addMockResponse({
        url: `/projects/${orgSlug}/${project.slug}/docs/javascript-react-with-error-monitoring-performance-and-replay/`,
        body: {html: 'javascript-react-with-error-monitoring-performance-and-replay'},
      });
    } else if (products.includes(PRODUCT.PERFORMANCE_MONITORING)) {
      MockApiClient.addMockResponse({
        url: `/projects/${orgSlug}/${project.slug}/docs/javascript-react-with-error-monitoring-and-performance/`,
        body: {html: 'javascript-react-with-error-monitoring-and-performance'},
      });
    } else if (products.includes(PRODUCT.SESSION_REPLAY)) {
      MockApiClient.addMockResponse({
        url: `/projects/${orgSlug}/${project.slug}/docs/javascript-react-with-error-monitoring-and-replay/`,
        body: {html: 'javascript-react-with-error-monitoring-and-replay'},
      });
    } else {
      MockApiClient.addMockResponse({
        url: `/projects/${orgSlug}/${project.slug}/docs/javascript-react-with-error-monitoring/`,
        body: {html: 'javascript-react-with-error-monitoring'},
      });
    }
  } else {
    MockApiClient.addMockResponse({
      url: `/projects/${orgSlug}/${project.slug}/docs/${project.platform}/`,
      body: {html: ''},
    });
  }
}

describe('Onboarding Setup Docs', function () {
  it('does not render Product Selection', async function () {
    const {router, route, routerContext, organization, project} = initializeOrg({
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
          route={route}
          location={router.location}
          genSkipOnboardingLink={() => ''}
          orgId={organization.slug}
          search=""
          recentCreatedProject={project}
        />
      </OnboardingContextProvider>,
      {
        context: routerContext,
        organization,
      }
    );

    expect(
      await screen.findByRole('heading', {name: 'Configure Python SDK'})
    ).toBeInTheDocument();

    expect(
      screen.queryByTestId(
        `product-${PRODUCT.ERROR_MONITORING}-${PRODUCT.PERFORMANCE_MONITORING}-${PRODUCT.SESSION_REPLAY}`
      )
    ).not.toBeInTheDocument();
  });

  describe('renders Product Selection', function () {
    it('all products checked', async function () {
      const {router, route, routerContext, organization, project} = initializeOrg({
        router: {
          location: {
            query: {product: [PRODUCT.PERFORMANCE_MONITORING, PRODUCT.SESSION_REPLAY]},
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
        location: router.location,
      });

      render(
        <OnboardingContextProvider>
          <SetupDocs
            active
            onComplete={() => {}}
            stepIndex={2}
            router={router}
            route={route}
            location={router.location}
            genSkipOnboardingLink={() => ''}
            orgId={organization.slug}
            search=""
            recentCreatedProject={project}
          />
        </OnboardingContextProvider>,
        {
          context: routerContext,
          organization,
        }
      );

      expect(
        await screen.findByRole('heading', {name: 'Configure React SDK'})
      ).toBeInTheDocument();

      // Render variation of docs - default (all checked)
      expect(
        await screen.findByText(
          'javascript-react-with-error-monitoring-performance-and-replay'
        )
      ).toBeInTheDocument();
    });

    it('only performance checked', async function () {
      const {router, route, routerContext, organization, project} = initializeOrg({
        router: {
          location: {
            query: {product: [PRODUCT.PERFORMANCE_MONITORING]},
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
        location: router.location,
      });

      render(
        <OnboardingContextProvider>
          <SetupDocs
            active
            onComplete={() => {}}
            stepIndex={2}
            router={router}
            route={route}
            location={router.location}
            genSkipOnboardingLink={() => ''}
            orgId={organization.slug}
            search=""
            recentCreatedProject={project}
          />
        </OnboardingContextProvider>,
        {
          context: routerContext,
          organization,
        }
      );

      // Render variation of docs - error monitoring and performance doc
      expect(
        await screen.findByText('javascript-react-with-error-monitoring-and-performance')
      ).toBeInTheDocument();
    });

    it('only session replay checked', async function () {
      const {router, route, routerContext, organization, project} = initializeOrg({
        router: {
          location: {
            query: {product: [PRODUCT.SESSION_REPLAY]},
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
        location: router.location,
      });

      render(
        <OnboardingContextProvider>
          <SetupDocs
            active
            onComplete={() => {}}
            stepIndex={2}
            router={router}
            route={route}
            location={router.location}
            genSkipOnboardingLink={() => ''}
            orgId={organization.slug}
            search=""
            recentCreatedProject={project}
          />
        </OnboardingContextProvider>,
        {
          context: routerContext,
          organization,
        }
      );

      // Render variation of docs - error monitoring and replay doc
      expect(
        await screen.findByText('javascript-react-with-error-monitoring-and-replay')
      ).toBeInTheDocument();
    });

    it('only error monitoring checked', async function () {
      const {router, route, routerContext, organization, project} = initializeOrg({
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
        location: router.location,
      });

      render(
        <OnboardingContextProvider>
          <SetupDocs
            active
            onComplete={() => {}}
            stepIndex={2}
            router={router}
            route={route}
            location={router.location}
            genSkipOnboardingLink={() => ''}
            orgId={organization.slug}
            search=""
            recentCreatedProject={project}
          />
        </OnboardingContextProvider>,
        {
          context: routerContext,
          organization,
        }
      );

      // Render variation of docs - error monitoring doc
      expect(
        await screen.findByText('javascript-react-with-error-monitoring')
      ).toBeInTheDocument();
    });
  });

  describe('JS Loader Script', function () {
    it('renders Loader Script setup', async function () {
      const {router, route, routerContext, organization, project} = initializeOrg({
        router: {
          location: {
            query: {product: [PRODUCT.PERFORMANCE_MONITORING, PRODUCT.SESSION_REPLAY]},
          },
        },
        projects: [
          {
            ...initializeOrg().project,
            slug: 'javascript',
            platform: 'javascript',
          },
        ],
      });

      const updateLoaderMock = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/keys/${PROJECT_KEY.id}/`,
        method: 'PUT',
        body: PROJECT_KEY,
      });

      ProjectsStore.init();
      ProjectsStore.loadInitialData([project]);

      renderMockRequests({
        project,
        orgSlug: organization.slug,
        location: router.location,
      });

      const {rerender} = render(
        <OnboardingContextProvider>
          <SetupDocs
            active
            onComplete={() => {}}
            stepIndex={2}
            router={router}
            route={route}
            location={router.location}
            genSkipOnboardingLink={() => ''}
            orgId={organization.slug}
            search=""
            recentCreatedProject={project}
          />
        </OnboardingContextProvider>,
        {
          context: routerContext,
          organization,
        }
      );

      expect(
        await screen.findByRole('heading', {name: 'Configure JavaScript SDK'})
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

      // update query in URL
      router.location.query = {
        product: [PRODUCT.SESSION_REPLAY],
      };
      rerender(
        <OnboardingContextProvider>
          <SetupDocs
            active
            onComplete={() => {}}
            stepIndex={2}
            router={router}
            route={route}
            location={router.location}
            genSkipOnboardingLink={() => ''}
            orgId={organization.slug}
            search=""
            recentCreatedProject={project}
          />
        </OnboardingContextProvider>
      );

      expect(updateLoaderMock).toHaveBeenCalledTimes(2);
      expect(updateLoaderMock).toHaveBeenLastCalledWith(
        expect.any(String), // The URL
        {
          data: {
            dynamicSdkLoaderOptions: {
              hasDebug: false,
              hasPerformance: false,
              hasReplay: true,
            },
          },
          error: expect.any(Function),
          method: 'PUT',
          success: expect.any(Function),
        }
      );
    });
  });
});
