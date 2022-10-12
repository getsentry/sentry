import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {generateOnboardingDocKeys} from 'sentry/components/performanceOnboarding/usePerformanceOnboardingDocs';
import SidebarContainer from 'sentry/components/sidebar';
import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {PersistedStoreProvider} from 'sentry/stores/persistedStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';
import {OrganizationContext} from 'sentry/views/organizationContext';
import {RouteContext} from 'sentry/views/routeContext';

jest.mock('sentry/actionCreators/serviceIncidents');

describe('Sidebar > Performance Onboarding Checklist', function () {
  const {organization, router} = initializeOrg({
    router: {
      location: {query: {}, search: ''},
      push: jest.fn(),
    },
  } as any);
  const broadcast = TestStubs.Broadcast();

  const apiMocks: any = {};

  const location = {...router.location, ...{pathname: '/test/'}};

  const getElement = props => {
    return (
      <RouteContext.Provider
        value={{
          location,
          params: {},
          router,
          routes: [],
        }}
      >
        <OrganizationContext.Provider value={props.organization}>
          <PersistedStoreProvider>
            <SidebarContainer
              organization={props.organization}
              location={location}
              {...props}
            />
          </PersistedStoreProvider>
        </OrganizationContext.Provider>
      </RouteContext.Provider>
    );
  };

  const renderSidebar = props => render(getElement(props));

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
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('displays boost performance card', async function () {
    const {container} = renderSidebar({
      organization: {
        ...organization,
        features: ['onboarding'],
      },
    });
    await waitFor(() => container);

    const quickStart = screen.getByText('Quick Start');

    expect(quickStart).toBeInTheDocument();
    userEvent.click(quickStart);

    const sidebar = await screen.findByRole('dialog');
    expect(sidebar).toBeInTheDocument();

    expect(screen.getByText('Capture your first error')).toBeInTheDocument();
    expect(screen.getByText('Level Up')).toBeInTheDocument();
    expect(screen.getByText('Boost performance')).toBeInTheDocument();

    userEvent.click(quickStart);
    expect(screen.queryByText('Boost performance')).not.toBeInTheDocument();
  });

  it('checklist feature disabled', async function () {
    const {container} = renderSidebar({
      organization: {
        ...organization,
        features: ['onboarding'],
      },
    });
    await waitFor(() => container);
    window.open = jest.fn().mockImplementation(() => true);

    const quickStart = screen.getByText('Quick Start');

    expect(quickStart).toBeInTheDocument();
    userEvent.click(quickStart);

    const sidebar = await screen.findByRole('dialog');
    expect(sidebar).toBeInTheDocument();

    expect(screen.getByText('Capture your first error')).toBeInTheDocument();
    expect(screen.getByText('Level Up')).toBeInTheDocument();
    expect(screen.getByText('Boost performance')).toBeInTheDocument();
    const performanceCard = screen.getByTestId('setup_transactions');

    userEvent.click(performanceCard);
    expect(window.open).toHaveBeenCalledWith(
      'https://docs.sentry.io/product/performance/getting-started/',
      '_blank'
    );
  });

  it('checklist feature enabled > navigate to performance page > project with onboarding support', async function () {
    ProjectsStore.loadInitialData([
      TestStubs.Project({platform: 'javascript-react', firstTransactionEvent: false}),
    ]);
    const {container} = renderSidebar({
      organization: {
        ...organization,
        features: ['onboarding', 'performance-onboarding-checklist'],
      },
    });
    await waitFor(() => container);
    window.open = jest.fn().mockImplementation(() => true);

    const quickStart = screen.getByText('Quick Start');

    expect(quickStart).toBeInTheDocument();
    userEvent.click(quickStart);

    const sidebar = await screen.findByRole('dialog');
    expect(sidebar).toBeInTheDocument();

    expect(screen.getByText('Capture your first error')).toBeInTheDocument();
    expect(screen.getByText('Level Up')).toBeInTheDocument();
    expect(screen.getByText('Boost performance')).toBeInTheDocument();
    const performanceCard = screen.getByTestId('setup_transactions');

    userEvent.click(performanceCard);
    expect(window.open).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith(
      '/organizations/org-slug/performance/?project=2#performance-sidequest'
    );
  });

  it('checklist feature enabled > navigate to performance page > project without onboarding support', async function () {
    ProjectsStore.loadInitialData([
      TestStubs.Project({platform: 'javascript-angular', firstTransactionEvent: false}),
    ]);
    const {container} = renderSidebar({
      organization: {
        ...organization,
        features: ['onboarding', 'performance-onboarding-checklist'],
      },
    });
    await waitFor(() => container);
    window.open = jest.fn().mockImplementation(() => true);

    const quickStart = screen.getByText('Quick Start');

    expect(quickStart).toBeInTheDocument();
    userEvent.click(quickStart);

    const sidebar = await screen.findByRole('dialog');
    expect(sidebar).toBeInTheDocument();

    expect(screen.getByText('Capture your first error')).toBeInTheDocument();
    expect(screen.getByText('Level Up')).toBeInTheDocument();
    expect(screen.getByText('Boost performance')).toBeInTheDocument();
    const performanceCard = screen.getByTestId('setup_transactions');

    userEvent.click(performanceCard);
    expect(window.open).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith(
      '/organizations/org-slug/performance/?project=2#performance-sidequest'
    );
  });

  it('checklist feature enabled > navigate to performance page > project without performance support', async function () {
    ProjectsStore.loadInitialData([
      TestStubs.Project({platform: 'elixir', firstTransactionEvent: false}),
    ]);
    const {container} = renderSidebar({
      organization: {
        ...organization,
        features: ['onboarding', 'performance-onboarding-checklist'],
      },
    });
    await waitFor(() => container);
    window.open = jest.fn().mockImplementation(() => true);

    const quickStart = screen.getByText('Quick Start');

    expect(quickStart).toBeInTheDocument();
    userEvent.click(quickStart);

    const sidebar = await screen.findByRole('dialog');
    expect(sidebar).toBeInTheDocument();

    expect(screen.getByText('Capture your first error')).toBeInTheDocument();
    expect(screen.getByText('Level Up')).toBeInTheDocument();
    expect(screen.getByText('Boost performance')).toBeInTheDocument();
    const performanceCard = screen.getByTestId('setup_transactions');

    userEvent.click(performanceCard);
    expect(window.open).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/organizations/org-slug/performance/');
  });

  it('displays checklist', async function () {
    const project = TestStubs.Project({
      platform: 'javascript-react',
      firstTransactionEvent: false,
    });
    ProjectsStore.loadInitialData([project]);

    const docApiMocks: any = {};
    const docKeys = generateOnboardingDocKeys(project.platform);

    docKeys.forEach(docKey => {
      docApiMocks[docKey] = MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/docs/${docKey}/`,
        method: 'GET',
        body: {html: `<h1>${docKey}</h1> content`},
      });
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      method: 'GET',
      body: {},
    });

    renderSidebar({
      organization: {
        ...organization,
        features: ['onboarding', 'performance-onboarding-checklist'],
      },
    });

    act(() => {
      SidebarPanelStore.activatePanel(SidebarPanelKey.PerformanceOnboarding);
    });

    expect(
      await screen.findByText(
        textWithMarkupMatcher('Adding Performance to your React project is simple.')
      )
    ).toBeInTheDocument();

    for (const docKey of docKeys) {
      expect(
        await screen.findByText(textWithMarkupMatcher(`${docKey} content`))
      ).toBeInTheDocument();
    }
  });
});
