import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import {OnboardingContextProvider} from 'sentry/components/onboarding/onboardingContext';
import * as useRecentCreatedProjectHook from 'sentry/components/onboarding/useRecentCreatedProject';
import {OnboardingProjectStatus} from 'sentry/types/onboarding';
import type {PlatformKey, Project} from 'sentry/types/project';
import Onboarding from 'sentry/views/onboarding/onboarding';

describe('Onboarding', function () {
  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders the welcome page', function () {
    const routeParams = {
      step: 'welcome',
    };

    const {routerProps, router, organization} = initializeOrg({
      router: {
        params: routeParams,
      },
    });

    render(
      <OnboardingContextProvider>
        <Onboarding {...routerProps} />
      </OnboardingContextProvider>,
      {
        router,
        organization,
      }
    );

    expect(screen.getByLabelText('Start')).toBeInTheDocument();
  });

  it('renders the select platform step', async function () {
    const routeParams = {
      step: 'select-platform',
    };

    const {routerProps, router, organization} = initializeOrg({
      router: {
        params: routeParams,
      },
    });

    render(
      <OnboardingContextProvider>
        <Onboarding {...routerProps} />
      </OnboardingContextProvider>,
      {
        router,
        organization,
      }
    );

    expect(
      await screen.findByText('Select the platform you want to monitor')
    ).toBeInTheDocument();
  });

  it('renders the setup docs step', async function () {
    const nextJsProject: Project = ProjectFixture({
      platform: 'javascript-nextjs',
      id: '2',
      slug: 'javascript-nextjs-slug',
    });

    const routeParams = {
      step: 'setup-docs',
    };

    const {routerProps, router, organization} = initializeOrg({
      router: {
        params: routeParams,
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sdks/`,
      body: {},
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

    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${nextJsProject.slug}/keys/`,
      method: 'GET',
      body: [ProjectKeysFixture()[0]],
    });

    jest
      .spyOn(useRecentCreatedProjectHook, 'useRecentCreatedProject')
      .mockImplementation(() => {
        return {
          project: nextJsProject,
          isProjectActive: false,
        };
      });

    render(
      <OnboardingContextProvider
        value={{
          selectedSDK: {
            key: nextJsProject.slug as PlatformKey,
            type: 'framework',
            language: 'javascript',
            category: 'browser',
            name: 'Next.js',
            link: 'https://docs.sentry.io/platforms/javascript/guides/nextjs/',
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
        <Onboarding {...routerProps} />
      </OnboardingContextProvider>,
      {
        router,
        organization,
      }
    );

    expect(await screen.findByText('Configure Next.js SDK')).toBeInTheDocument();
  });

  it('renders SDK data removal modal when going back', async function () {
    const reactProject: Project = ProjectFixture({
      platform: 'javascript-react',
      id: '2',
      slug: 'javascript-react-slug',
      firstTransactionEvent: false,
      firstEvent: null,
      hasReplays: false,
      hasSessions: false,
    });

    const routeParams = {
      step: 'setup-docs',
    };

    const {routerProps, router, organization} = initializeOrg({
      router: {
        params: routeParams,
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sdks/`,
      body: {},
    });

    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${reactProject.slug}/`,
      body: [reactProject],
    });

    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${reactProject.slug}/keys/`,
      method: 'GET',
      body: [ProjectKeysFixture()[0]],
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${reactProject.slug}/issues/`,
      body: [],
    });

    jest
      .spyOn(useRecentCreatedProjectHook, 'useRecentCreatedProject')
      .mockImplementation(() => {
        return {
          project: reactProject,
          isProjectActive: false,
        };
      });

    render(
      <OnboardingContextProvider
        value={{
          selectedSDK: {
            key: reactProject.slug as PlatformKey,
            type: 'framework',
            language: 'javascript',
            category: 'browser',
            name: 'Rect',
            link: 'https://docs.sentry.io/platforms/javascript/guides/react/',
          },
          projects: {
            [reactProject.id]: {
              slug: reactProject.slug,
              status: OnboardingProjectStatus.WAITING,
              firstIssueId: undefined,
            },
          },
        }}
      >
        <Onboarding {...routerProps} />
      </OnboardingContextProvider>,
      {
        router,
        organization,
      }
    );

    // Await for the docs to be loaded
    await screen.findByText('Configure React SDK');

    renderGlobalModal();

    // Click on back button
    await userEvent.click(screen.getByRole('button', {name: 'Back'}));

    // Await for the modal to be open
    expect(
      await screen.findByText(/Are you sure you want to head back?/)
    ).toBeInTheDocument();

    // Close modal
    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
  });

  it('does not render SDK data removal modal when going back', async function () {
    const reactProject: Project = ProjectFixture({
      platform: 'javascript-react',
      id: '2',
      slug: 'javascript-react-slug',
    });

    const routeParams = {
      step: 'setup-docs',
    };

    const {routerProps, router, organization} = initializeOrg({
      router: {
        params: routeParams,
      },
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sdks/`,
      body: {},
    });

    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${reactProject.slug}/`,
      body: [reactProject],
    });

    MockApiClient.addMockResponse({
      url: `/projects/org-slug/${reactProject.slug}/keys/`,
      method: 'GET',
      body: [ProjectKeysFixture()[0]],
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${reactProject.slug}/issues/`,
      body: [],
    });

    jest
      .spyOn(useRecentCreatedProjectHook, 'useRecentCreatedProject')
      .mockImplementation(() => {
        return {
          project: reactProject,
          isProjectActive: true,
        };
      });

    render(
      <OnboardingContextProvider
        value={{
          selectedSDK: {
            key: reactProject.slug as PlatformKey,
            type: 'framework',
            language: 'javascript',
            category: 'browser',
            name: 'Rect',
            link: 'https://docs.sentry.io/platforms/javascript/guides/react/',
          },
          projects: {
            [reactProject.id]: {
              slug: reactProject.slug,
              status: OnboardingProjectStatus.WAITING,
              firstIssueId: undefined,
            },
          },
        }}
      >
        <Onboarding {...routerProps} />
      </OnboardingContextProvider>,
      {
        router,
        organization,
      }
    );

    // Await for the docs to be loaded
    await screen.findByText('Configure React SDK');

    renderGlobalModal();

    // Click on back button
    await userEvent.click(screen.getByRole('button', {name: 'Back'}));

    // Await for the modal to be open
    expect(
      screen.queryByText(/Are you sure you want to head back?/)
    ).not.toBeInTheDocument();
  });

  it('renders framework selection modal if vanilla js is selected', async function () {
    const routeParams = {
      step: 'select-platform',
    };

    const {routerProps, router, organization} = initializeOrg({
      router: {
        params: routeParams,
      },
    });

    render(
      <OnboardingContextProvider>
        <Onboarding {...routerProps} />
      </OnboardingContextProvider>,
      {
        router,
        organization,
      }
    );

    renderGlobalModal();

    // Select the JavaScript platform
    await userEvent.click(screen.getByTestId('platform-javascript'));

    // Click on 'configure SDK' button
    await userEvent.click(screen.getByRole('button', {name: 'Configure SDK'}));

    // Modal is open
    await screen.findByText('Do you use a framework?');
  });

  it('does not render framework selection modal if vanilla js is NOT selected', async function () {
    const routeParams = {
      step: 'select-platform',
    };

    const {routerProps, router, organization} = initializeOrg({
      router: {
        params: routeParams,
      },
    });

    render(
      <OnboardingContextProvider>
        <Onboarding {...routerProps} />
      </OnboardingContextProvider>,
      {
        router,
        organization,
      }
    );

    // Select the React platform
    await userEvent.click(screen.getByTestId('platform-javascript-vue'));

    // Click on 'configure SDK' button
    await userEvent.click(screen.getByRole('button', {name: 'Configure SDK'}));

    // Modal shall not be open
    expect(screen.queryByText('Do you use a framework?')).not.toBeInTheDocument();
  });
});
