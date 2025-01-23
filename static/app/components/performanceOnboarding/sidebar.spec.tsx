import type {UseQueryResult} from '@tanstack/react-query';
import {BroadcastFixture} from 'sentry-fixture/broadcast';
import {ProjectFixture} from 'sentry-fixture/project';
import {ProjectKeysFixture} from 'sentry-fixture/projectKeys';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {OnboardingContextProvider} from 'sentry/components/onboarding/onboardingContext';
import SidebarContainer from 'sentry/components/sidebar';
import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import type {PlatformKey, Project} from 'sentry/types/project';
import type {StatuspageIncident} from 'sentry/types/system';
import * as incidentsHook from 'sentry/utils/useServiceIncidents';

jest.mock('sentry/utils/useServiceIncidents');

describe('Sidebar > Performance Onboarding Checklist', function () {
  const {organization, router} = initializeOrg({
    router: {
      location: {query: {}, search: '', pathname: '/test/'},
    },
  });
  const broadcast = BroadcastFixture();

  const apiMocks: any = {};

  const getElement = () => {
    return (
      <OnboardingContextProvider>
        <SidebarContainer />
      </OnboardingContextProvider>
    );
  };

  const renderSidebar = (props: any) =>
    render(getElement(), {organization: props.organization, router});

  beforeEach(function () {
    jest.resetAllMocks();
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(
      {
        projects: [],
        environments: [],
        datetime: {start: null, end: null, period: '24h', utc: null},
      },
      new Set()
    );
    apiMocks.broadcasts = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/broadcasts/`,
      body: [broadcast],
    });

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/onboarding-tasks/`,
      method: 'GET',
      body: {
        onboardingTasks: [],
      },
    });

    const statusPageData: StatuspageIncident[] = [];
    jest
      .spyOn(incidentsHook, 'useServiceIncidents')
      .mockImplementation(
        () => ({data: statusPageData}) as UseQueryResult<StatuspageIncident[]>
      );
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('displays "Set up Tracing" card', async function () {
    ProjectsStore.loadInitialData([
      ProjectFixture({platform: 'javascript-react', firstTransactionEvent: false}),
    ]);

    renderSidebar({
      organization: {
        ...organization,
        features: ['onboarding'],
      },
    });

    const quickStart = await screen.findByText('Onboarding');

    expect(quickStart).toBeInTheDocument();
    await userEvent.click(quickStart);

    const sidebar = await screen.findByRole('dialog');
    expect(sidebar).toBeInTheDocument();

    expect(screen.getByText('Capture your first error')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Beyond the Basics'));
    expect(await screen.findByText('Set up Tracing')).toBeInTheDocument();

    await userEvent.click(quickStart);
    expect(screen.queryByText('Set up Tracing')).not.toBeInTheDocument();
  });

  it('checklist feature supported by platform but disabled', async function () {
    ProjectsStore.loadInitialData([
      ProjectFixture({platform: 'javascript-react', firstTransactionEvent: false}),
    ]);
    renderSidebar({
      organization: {
        ...organization,
        features: ['onboarding'],
      },
    });

    window.open = jest.fn().mockImplementation(() => true);

    const quickStart = await screen.findByText('Onboarding');

    expect(quickStart).toBeInTheDocument();
    await userEvent.click(quickStart);

    const sidebar = await screen.findByRole('dialog');
    expect(sidebar).toBeInTheDocument();

    expect(screen.getByText('Capture your first error')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Beyond the Basics'));
    expect(await screen.findByText('Set up Tracing')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Set up Tracing'));
    expect(window.open).toHaveBeenCalledWith(
      'https://docs.sentry.io/product/performance/getting-started/',
      '_blank'
    );
  });

  it('checklist feature enabled > navigate to performance page > project with onboarding support', async function () {
    ProjectsStore.loadInitialData([
      ProjectFixture({platform: 'javascript-react', firstTransactionEvent: false}),
    ]);
    renderSidebar({
      organization: {
        ...organization,
        features: ['onboarding', 'performance-onboarding-checklist'],
      },
    });
    window.open = jest.fn().mockImplementation(() => true);

    const quickStart = await screen.findByText('Onboarding');

    expect(quickStart).toBeInTheDocument();
    await userEvent.click(quickStart);

    const sidebar = await screen.findByRole('dialog');
    expect(sidebar).toBeInTheDocument();

    expect(screen.getByText('Capture your first error')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Beyond the Basics'));
    expect(await screen.findByText('Set up Tracing')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Set up Tracing'));
    expect(window.open).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith(
      '/organizations/org-slug/performance/?project=2#performance-sidequest'
    );
  });

  it('checklist feature enabled > navigate to performance page > project without onboarding support', async function () {
    ProjectsStore.loadInitialData([
      ProjectFixture({platform: 'javascript-angular', firstTransactionEvent: false}),
    ]);
    renderSidebar({
      organization: {
        ...organization,
        features: ['onboarding', 'performance-onboarding-checklist'],
      },
    });
    window.open = jest.fn().mockImplementation(() => true);

    const quickStart = await screen.findByText('Onboarding');

    expect(quickStart).toBeInTheDocument();
    await userEvent.click(quickStart);

    const sidebar = await screen.findByRole('dialog');
    expect(sidebar).toBeInTheDocument();

    expect(screen.getByText('Capture your first error')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Beyond the Basics'));
    expect(await screen.findByText('Set up Tracing')).toBeInTheDocument();

    await userEvent.click(screen.getByText('Set up Tracing'));
    expect(window.open).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith(
      '/organizations/org-slug/performance/?project=2#performance-sidequest'
    );
  });

  it('checklist feature enabled > navigate to performance page > project without performance support', async function () {
    const project = ProjectFixture({
      platform: 'elixir',
      firstTransactionEvent: false,
    }) as Project & {platform: PlatformKey};
    ProjectsStore.loadInitialData([project]);
    renderSidebar({
      organization: {
        ...organization,
        features: ['onboarding', 'performance-onboarding-checklist'],
      },
    });

    window.open = jest.fn().mockImplementation(() => true);

    const quickStart = await screen.findByText('Onboarding');

    expect(quickStart).toBeInTheDocument();
    await userEvent.click(quickStart);

    const sidebar = await screen.findByRole('dialog');
    expect(sidebar).toBeInTheDocument();

    expect(screen.getByText('Capture your first error')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Beyond the Basics'));
    expect(screen.queryByText('Set up Tracing')).not.toBeInTheDocument();
  });

  it('displays checklist', async function () {
    const project = ProjectFixture({
      platform: 'javascript-react',
      firstTransactionEvent: false,
    });
    ProjectsStore.loadInitialData([project]);

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'GET',
      body: {},
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/keys/`,
      body: ProjectKeysFixture(),
    });

    renderSidebar({
      organization: {
        ...organization,
        features: ['onboarding', 'performance-onboarding-checklist'],
      },
    });

    act(() => {
      SidebarPanelStore.activatePanel(SidebarPanelKey.PERFORMANCE_ONBOARDING);
    });

    expect(
      await screen.findByText(
        textWithMarkupMatcher('Adding Performance to your React project is simple.')
      )
    ).toBeInTheDocument();
  });
});
