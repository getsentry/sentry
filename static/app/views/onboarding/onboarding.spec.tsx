import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';
import {TeamFixture} from 'sentry-fixture/team';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {OnboardingContextProvider} from 'sentry/components/onboarding/onboardingContext';
import * as useRecentCreatedProjectHook from 'sentry/components/onboarding/useRecentCreatedProject';
import ProjectsStore from 'sentry/stores/projectsStore';
import TeamStore from 'sentry/stores/teamStore';
import type {PlatformKey, Project} from 'sentry/types/project';
import {OnboardingWithoutContext} from 'sentry/views/onboarding/onboarding';

describe('Onboarding', () => {
  beforeAll(() => {
    TeamStore.loadInitialData([TeamFixture()]);
  });
  afterEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.reset();
  });

  it('renders the welcome page', () => {
    render(
      <OnboardingContextProvider>
        <OnboardingWithoutContext />
      </OnboardingContextProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/onboarding/org-slug/welcome/',
          },
          route: '/onboarding/:orgId/:step/',
        },
      }
    );

    expect(screen.getByLabelText('Start')).toBeInTheDocument();
  });

  it('renders the select platform step', async () => {
    render(
      <OnboardingContextProvider>
        <OnboardingWithoutContext />
      </OnboardingContextProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/onboarding/org-slug/select-platform/',
          },
          route: '/onboarding/:orgId/:step/',
        },
      }
    );

    expect(
      await screen.findByText('Select the platform you want to monitor')
    ).toBeInTheDocument();
  });

  it('renders the setup docs step', async () => {
    const organization = OrganizationFixture();
    const nextJsProject: Project = ProjectFixture({
      platform: 'javascript-nextjs',
      id: '2',
      slug: 'javascript-nextjs-slug',
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
      url: `/projects/${organization.slug}/${nextJsProject.slug}/`,
      body: [nextJsProject],
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${nextJsProject.slug}/issues/`,
      body: [],
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${nextJsProject.slug}/keys/`,
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
          selectedPlatform: {
            key: nextJsProject.slug as PlatformKey,
            type: 'framework',
            language: 'javascript',
            category: 'browser',
            name: 'Next.js',
            link: 'https://docs.sentry.io/platforms/javascript/guides/nextjs/',
          },
        }}
      >
        <OnboardingWithoutContext />
      </OnboardingContextProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: `/onboarding/${organization.slug}/setup-docs/`,
          },
          route: '/onboarding/:orgId/:step/',
        },
      }
    );

    expect(await screen.findByText('Configure Next.js SDK')).toBeInTheDocument();
  });

  it('does not render SDK data removal modal when going back', async () => {
    const organization = OrganizationFixture();
    const reactProject: Project = ProjectFixture({
      platform: 'javascript-react',
      id: '2',
      slug: 'javascript-react-slug',
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sdks/`,
      body: {},
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${reactProject.slug}/`,
      body: [reactProject],
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${reactProject.slug}/keys/`,
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
          selectedPlatform: {
            key: reactProject.slug as PlatformKey,
            type: 'framework',
            language: 'javascript',
            category: 'browser',
            name: 'React',
            link: 'https://docs.sentry.io/platforms/javascript/guides/react/',
          },
        }}
      >
        <OnboardingWithoutContext />
      </OnboardingContextProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: `/onboarding/${organization.slug}/setup-docs/`,
          },
          route: '/onboarding/:orgId/:step/',
        },
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

  it('renders framework selection modal if vanilla js is selected', async () => {
    render(
      <OnboardingContextProvider>
        <OnboardingWithoutContext />
      </OnboardingContextProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: '/onboarding/org-slug/select-platform/',
          },
          route: '/onboarding/:orgId/:step/',
        },
      }
    );

    renderGlobalModal();

    // Select the JavaScript platform
    await userEvent.click(screen.getByTestId('platform-javascript'));

    // Modal is open
    await screen.findByText('Do you use a framework?');
  });

  it('no longer display SDK data removal modal when going back', async () => {
    const organization = OrganizationFixture();
    const reactProject: Project = ProjectFixture({
      platform: 'javascript-react',
      id: '2',
      slug: 'javascript-react-slug',
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sdks/`,
      body: {},
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${reactProject.slug}/`,
      body: [reactProject],
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${reactProject.slug}/keys/`,
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
          selectedPlatform: {
            key: reactProject.slug as PlatformKey,
            type: 'framework',
            language: 'javascript',
            category: 'browser',
            name: 'React',
            link: 'https://docs.sentry.io/platforms/javascript/guides/react/',
          },
        }}
      >
        <OnboardingWithoutContext />
      </OnboardingContextProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: `/onboarding/${organization.slug}/setup-docs/`,
          },
          route: '/onboarding/:orgId/:step/',
        },
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

  it('loads doc on platform click', async () => {
    const organization = OrganizationFixture();
    const nextJsProject: Project = ProjectFixture({
      platform: 'javascript-nextjs',
      id: '2',
      slug: 'javascript-nextjs',
    });

    ProjectsStore.loadInitialData([nextJsProject]);

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/`,
      body: {},
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      method: 'GET',
      body: [nextJsProject],
    });

    // Mock for useRecentCreatedProject hook
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${nextJsProject.slug}/overview/`,
      body: [nextJsProject],
    });

    // Minimal mocks needed for SetupDocs to render without errors
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/sdks/`,
      body: {},
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${nextJsProject.slug}/keys/`,
      method: 'GET',
      body: [ProjectKeysFixture()[0]],
    });

    MockApiClient.addMockResponse({
      url: `/projects/org-slug/javascript-react-slug/keys/`,
      method: 'GET',
      body: [ProjectKeysFixture()[0]],
    });

    const {router} = render(
      <OnboardingContextProvider>
        <OnboardingWithoutContext />
      </OnboardingContextProvider>,
      {
        initialRouterConfig: {
          location: {
            pathname: `/onboarding/${organization.slug}/select-platform/`,
          },
          route: '/onboarding/:orgId/:step/',
        },
      }
    );

    // Select the Next.JS platform
    await userEvent.click(screen.getByTestId('platform-javascript-nextjs'));

    // Modal shall not be open
    expect(screen.queryByText('Do you use a framework?')).not.toBeInTheDocument();

    // Load docs for the selected platform
    await waitFor(() => {
      expect(router.location.pathname).toBe(
        `/onboarding/${organization.slug}/setup-docs/`
      );
    });
  });
});
