import {Broadcast} from 'sentry-fixture/broadcast';
import {Project} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {OnboardingContextProvider} from 'sentry/components/onboarding/onboardingContext';
import SidebarContainer from 'sentry/components/sidebar';
import {SidebarPanelKey} from 'sentry/components/sidebar/types';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import SidebarPanelStore from 'sentry/stores/sidebarPanelStore';

import {generateDocKeys} from './utils';

jest.mock('sentry/actionCreators/serviceIncidents');

describe('Sidebar > Performance Onboarding Checklist', function () {
  const {organization, routerContext, router} = initializeOrg({
    router: {
      location: {query: {}, search: '', pathname: '/test/'},
    },
  });
  const broadcast = Broadcast();

  const apiMocks: any = {};

  const getElement = (props: React.ComponentProps<typeof SidebarContainer>) => {
    return (
      <OnboardingContextProvider>
        <SidebarContainer organization={props.organization} {...props} />
      </OnboardingContextProvider>
    );
  };

  const renderSidebar = props =>
    render(getElement(props), {organization: props.organization, context: routerContext});

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
    renderSidebar({
      organization: {
        ...organization,
        features: ['onboarding'],
      },
    });

    const quickStart = await screen.findByText('Quick Start');

    expect(quickStart).toBeInTheDocument();
    await userEvent.click(quickStart);

    const sidebar = await screen.findByRole('dialog');
    expect(sidebar).toBeInTheDocument();

    expect(screen.getByText('Capture your first error')).toBeInTheDocument();
    expect(screen.getByText('Level Up')).toBeInTheDocument();
    expect(screen.getByText('Boost performance')).toBeInTheDocument();

    await userEvent.click(quickStart);
    expect(screen.queryByText('Boost performance')).not.toBeInTheDocument();
  });

  it('checklist feature disabled', async function () {
    renderSidebar({
      organization: {
        ...organization,
        features: ['onboarding'],
      },
    });

    window.open = jest.fn().mockImplementation(() => true);

    const quickStart = await screen.findByText('Quick Start');

    expect(quickStart).toBeInTheDocument();
    await userEvent.click(quickStart);

    const sidebar = await screen.findByRole('dialog');
    expect(sidebar).toBeInTheDocument();

    expect(screen.getByText('Capture your first error')).toBeInTheDocument();
    expect(screen.getByText('Level Up')).toBeInTheDocument();
    expect(screen.getByText('Boost performance')).toBeInTheDocument();
    const performanceCard = screen.getByTestId('setup_transactions');

    await userEvent.click(performanceCard);
    expect(window.open).toHaveBeenCalledWith(
      'https://docs.sentry.io/product/performance/getting-started/',
      '_blank'
    );
  });

  it('checklist feature enabled > navigate to performance page > project with onboarding support', async function () {
    ProjectsStore.loadInitialData([
      Project({platform: 'javascript-react', firstTransactionEvent: false}),
    ]);
    renderSidebar({
      organization: {
        ...organization,
        features: ['onboarding', 'performance-onboarding-checklist'],
      },
    });
    window.open = jest.fn().mockImplementation(() => true);

    const quickStart = await screen.findByText('Quick Start');

    expect(quickStart).toBeInTheDocument();
    await userEvent.click(quickStart);

    const sidebar = await screen.findByRole('dialog');
    expect(sidebar).toBeInTheDocument();

    expect(screen.getByText('Capture your first error')).toBeInTheDocument();
    expect(screen.getByText('Level Up')).toBeInTheDocument();
    expect(screen.getByText('Boost performance')).toBeInTheDocument();
    const performanceCard = screen.getByTestId('setup_transactions');

    await userEvent.click(performanceCard);
    expect(window.open).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith(
      '/organizations/org-slug/performance/?project=2#performance-sidequest'
    );
  });

  it('checklist feature enabled > navigate to performance page > project without onboarding support', async function () {
    ProjectsStore.loadInitialData([
      Project({platform: 'javascript-angular', firstTransactionEvent: false}),
    ]);
    renderSidebar({
      organization: {
        ...organization,
        features: ['onboarding', 'performance-onboarding-checklist'],
      },
    });
    window.open = jest.fn().mockImplementation(() => true);

    const quickStart = await screen.findByText('Quick Start');

    expect(quickStart).toBeInTheDocument();
    await userEvent.click(quickStart);

    const sidebar = await screen.findByRole('dialog');
    expect(sidebar).toBeInTheDocument();

    expect(screen.getByText('Capture your first error')).toBeInTheDocument();
    expect(screen.getByText('Level Up')).toBeInTheDocument();
    expect(screen.getByText('Boost performance')).toBeInTheDocument();
    const performanceCard = screen.getByTestId('setup_transactions');

    await userEvent.click(performanceCard);
    expect(window.open).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith(
      '/organizations/org-slug/performance/?project=2#performance-sidequest'
    );
  });

  it('checklist feature enabled > navigate to performance page > project without performance support', async function () {
    ProjectsStore.loadInitialData([
      Project({platform: 'elixir', firstTransactionEvent: false}),
    ]);
    renderSidebar({
      organization: {
        ...organization,
        features: ['onboarding', 'performance-onboarding-checklist'],
      },
    });
    window.open = jest.fn().mockImplementation(() => true);

    const quickStart = await screen.findByText('Quick Start');

    expect(quickStart).toBeInTheDocument();
    await userEvent.click(quickStart);

    const sidebar = await screen.findByRole('dialog');
    expect(sidebar).toBeInTheDocument();

    expect(screen.getByText('Capture your first error')).toBeInTheDocument();
    expect(screen.getByText('Level Up')).toBeInTheDocument();
    expect(screen.getByText('Boost performance')).toBeInTheDocument();
    const performanceCard = screen.getByTestId('setup_transactions');

    await userEvent.click(performanceCard);
    expect(window.open).not.toHaveBeenCalled();
    expect(router.push).toHaveBeenCalledWith('/organizations/org-slug/performance/');
  });

  it('displays checklist', async function () {
    const project = Project({
      platform: 'javascript-react',
      firstTransactionEvent: false,
    });
    ProjectsStore.loadInitialData([project]);

    const docApiMocks: any = {};
    const docKeys = generateDocKeys(project.platform!);

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
      SidebarPanelStore.activatePanel(SidebarPanelKey.PERFORMANCE_ONBOARDING);
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
