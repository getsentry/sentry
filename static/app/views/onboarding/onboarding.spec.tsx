import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import {OnboardingContextProvider} from 'sentry/components/onboarding/onboardingContext';
import {PlatformKey} from 'sentry/data/platformCategories';
import OrganizationStore from 'sentry/stores/organizationStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {OnboardingProjectStatus, Project} from 'sentry/types';
import Onboarding from 'sentry/views/onboarding/onboarding';

describe('Onboarding', function () {
  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders the welcome page', function () {
    const routeParams = {
      step: 'welcome',
    };

    const {router, route, routerContext} = initializeOrg({
      ...initializeOrg(),
      router: {
        params: routeParams,
      },
    });

    render(
      <OnboardingContextProvider>
        <Onboarding
          router={router}
          location={router.location}
          params={routeParams}
          routes={router.routes}
          routeParams={router.params}
          route={route}
        />
      </OnboardingContextProvider>,
      {
        context: routerContext,
      }
    );

    expect(screen.getByLabelText('Start')).toBeInTheDocument();
    expect(screen.getByLabelText('Invite Team')).toBeInTheDocument();
  });

  it('renders the select platform step', async function () {
    const routeParams = {
      step: 'select-platform',
    };

    const {router, route, routerContext, organization} = initializeOrg({
      ...initializeOrg(),
      router: {
        params: routeParams,
      },
    });

    OrganizationStore.onUpdate(organization);

    render(
      <OnboardingContextProvider>
        <Onboarding
          router={router}
          location={router.location}
          params={routeParams}
          routes={router.routes}
          routeParams={router.params}
          route={route}
        />
      </OnboardingContextProvider>,
      {
        context: routerContext,
      }
    );

    expect(
      await screen.findByText('Select the platform you want to monitor')
    ).toBeInTheDocument();
  });

  it('renders the setup docs step', async function () {
    const nextJsProject: Project = TestStubs.Project({
      platform: 'javascript-nextjs',
      id: '2',
      slug: 'javascript-nextjs-slug',
    });

    const routeParams = {
      step: 'setup-docs',
    };

    const {router, route, routerContext, organization} = initializeOrg({
      ...initializeOrg(),
      router: {
        params: routeParams,
      },
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${nextJsProject.slug}/docs/javascript-nextjs-with-error-monitoring/`,
      body: null,
    });

    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${nextJsProject.slug}/`,
      body: [nextJsProject],
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${nextJsProject.slug}/issues/`,
      body: [],
    });

    ProjectsStore.loadInitialData([nextJsProject]);

    OrganizationStore.onUpdate(organization);

    render(
      <OnboardingContextProvider
        value={{
          selectedSDK: {
            key: nextJsProject.slug as PlatformKey,
            type: 'framework',
            language: 'javascript',
            category: 'browser',
          },
          projects: {
            [nextJsProject.id]: {
              slug: nextJsProject.slug,
              status: OnboardingProjectStatus.WAITING,
              firstIssueId: undefined,
            },
          },
        }}
      >
        <Onboarding
          router={router}
          location={router.location}
          params={routeParams}
          routes={router.routes}
          routeParams={router.params}
          route={route}
        />
      </OnboardingContextProvider>,
      {
        context: routerContext,
      }
    );

    expect(await screen.findByText('Configure Next.js SDK')).toBeInTheDocument();
  });

  it('renders framework selection modal if vanilla js is selected', async function () {
    const routeParams = {
      step: 'select-platform',
    };

    const {router, route, routerContext, organization} = initializeOrg({
      ...initializeOrg(),
      organization: {
        ...initializeOrg().organization,
        features: ['onboarding-sdk-selection'],
      },
      router: {
        params: routeParams,
      },
    });

    render(
      <OnboardingContextProvider>
        <Onboarding
          router={router}
          location={router.location}
          params={routeParams}
          routes={router.routes}
          routeParams={router.params}
          route={route}
        />
      </OnboardingContextProvider>,
      {
        context: routerContext,
        organization,
      }
    );

    renderGlobalModal();

    // Select the JavaScript platform
    await userEvent.click(screen.getByTestId('platform-javascript'));

    // Click on create project button
    await userEvent.click(screen.getByRole('button', {name: 'Create Project'}));

    // Modal is open
    await screen.findByText('Do you use a framework?');

    // Close modal
    await userEvent.click(screen.getByRole('button', {name: 'Skip'}));
  });

  it('does not render framework selection modal if vanilla js is NOT selected', async function () {
    const routeParams = {
      step: 'select-platform',
    };

    const {router, route, routerContext, organization} = initializeOrg({
      ...initializeOrg(),
      organization: {
        ...initializeOrg().organization,
        features: ['onboarding-sdk-selection'],
      },
      router: {
        params: routeParams,
      },
    });

    render(
      <OnboardingContextProvider>
        <Onboarding
          router={router}
          location={router.location}
          params={routeParams}
          routes={router.routes}
          routeParams={router.params}
          route={route}
        />
      </OnboardingContextProvider>,
      {
        context: routerContext,
        organization,
      }
    );

    // Select the React platform
    await userEvent.click(screen.getByTestId('platform-javascript-react'));

    // Click on create project button
    await userEvent.click(screen.getByRole('button', {name: 'Create Project'}));

    // Modal shall not be open
    expect(screen.queryByText('Do you use a framework?')).not.toBeInTheDocument();
  });
});
