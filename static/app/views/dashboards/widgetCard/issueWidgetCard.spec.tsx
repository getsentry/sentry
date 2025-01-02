import {DashboardFixture} from 'sentry-fixture/dashboard';
import {LocationFixture} from 'sentry-fixture/locationFixture';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  makeAllTheProviders,
  render,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import MemberListStore from 'sentry/stores/memberListStore';
import {MEPSettingProvider} from 'sentry/utils/performance/contexts/metricsEnhancedSetting';
import type {Widget} from 'sentry/views/dashboards/types';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import WidgetCard from 'sentry/views/dashboards/widgetCard';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

import WidgetLegendSelectionState from '../widgetLegendSelectionState';

import {DashboardsMEPProvider} from './dashboardsMEPContext';

describe('Dashboards > IssueWidgetCard', function () {
  const {router, organization} = initializeOrg({
    organization: OrganizationFixture({
      features: ['dashboards-edit'],
    }),
    router: {orgId: 'orgId'},
  } as Parameters<typeof initializeOrg>[0]);

  const widget: Widget = {
    title: 'Issues',
    interval: '5m',
    displayType: DisplayType.TABLE,
    widgetType: WidgetType.ISSUE,
    queries: [
      {
        conditions: 'event.type:default',
        fields: ['issue', 'assignee', 'title'],
        columns: ['issue', 'assignee', 'title'],
        aggregates: [],
        name: '',
        orderby: IssueSortOptions.FREQ,
      },
    ],
  };
  const selection = {
    projects: [1],
    environments: ['prod'],
    datetime: {
      period: '14d',
      start: null,
      end: null,
      utc: false,
    },
  };

  const BasicProvidersWrapper = makeAllTheProviders({organization, router});
  function Wrapper({children}: {children: React.ReactNode}) {
    return (
      <BasicProvidersWrapper>
        <DashboardsMEPProvider>
          <MEPSettingProvider forceTransactions={false}>{children}</MEPSettingProvider>
        </DashboardsMEPProvider>
      </BasicProvidersWrapper>
    );
  }

  const user = UserFixture();
  const api = new MockApiClient();

  const widgetLegendState = new WidgetLegendSelectionState({
    location: LocationFixture(),
    dashboard: DashboardFixture([widget]),
    organization,
    router,
  });

  beforeEach(function () {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
      body: [
        {
          id: '44444444',
          title: 'ChunkLoadError: Loading chunk app_bootstrap_index_tsx failed.',
          shortId: 'ISSUE',
          assignedTo: {
            type: 'user',
            id: user.id,
            name: user.name,
            email: user.email,
          },
          lifetime: {count: 10, userCount: 5},
          count: 6,
          userCount: 3,
          project: {id: 1},
        },
      ],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      method: 'GET',
      body: [user],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  it('renders with title and issues chart', async function () {
    MemberListStore.loadInitialData([user]);
    render(
      <WidgetCard
        api={api}
        organization={organization}
        widget={widget}
        selection={selection}
        isEditingDashboard={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        showContextMenu
        widgetLimitReached={false}
        widgetLegendState={widgetLegendState}
      />,
      {wrapper: Wrapper}
    );

    expect(await screen.findByText('Issues')).toBeInTheDocument();
    expect(await screen.findByText('assignee')).toBeInTheDocument();
    expect(screen.getByText('title')).toBeInTheDocument();
    expect(screen.getByText('issue')).toBeInTheDocument();
    expect(screen.getByText('FB')).toBeInTheDocument();
    expect(screen.getByText('ISSUE')).toBeInTheDocument();
    expect(
      screen.getByText('ChunkLoadError: Loading chunk app_bootstrap_index_tsx failed.')
    ).toBeInTheDocument();
    await userEvent.hover(screen.getByTitle(user.name));
    expect(await screen.findByText(`Assigned to ${user.name}`)).toBeInTheDocument();
  });

  it('opens in issues page', async function () {
    render(
      <WidgetCard
        api={api}
        organization={organization}
        widget={widget}
        selection={selection}
        isEditingDashboard={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        showContextMenu
        widgetLimitReached={false}
        widgetLegendState={widgetLegendState}
      />,
      {wrapper: Wrapper}
    );

    await userEvent.click(await screen.findByLabelText('Widget actions'));
    expect(screen.getByText('Duplicate Widget')).toBeInTheDocument();

    expect(screen.getByRole('link', {name: 'Open in Issues'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/?environment=prod&project=1&query=event.type%3Adefault&sort=freq&statsPeriod=14d'
    );
  });

  it('calls onDuplicate when Duplicate Widget is clicked', async function () {
    const mock = jest.fn();
    render(
      <WidgetCard
        api={api}
        organization={organization}
        widget={widget}
        selection={selection}
        isEditingDashboard={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={mock}
        renderErrorMessage={() => undefined}
        showContextMenu
        widgetLimitReached={false}
        widgetLegendState={widgetLegendState}
      />,
      {wrapper: Wrapper}
    );

    await userEvent.click(await screen.findByLabelText('Widget actions'));
    expect(screen.getByText('Duplicate Widget')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Duplicate Widget'));
    expect(mock).toHaveBeenCalledTimes(1);
  });

  it('disables the duplicate widget button if max widgets is reached', async function () {
    const mock = jest.fn();
    render(
      <WidgetCard
        api={api}
        organization={organization}
        widget={widget}
        selection={selection}
        isEditingDashboard={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={mock}
        renderErrorMessage={() => undefined}
        showContextMenu
        widgetLimitReached
        widgetLegendState={widgetLegendState}
      />,
      {wrapper: Wrapper}
    );

    await userEvent.click(await screen.findByLabelText('Widget actions'));
    expect(screen.getByText('Duplicate Widget')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Duplicate Widget'));
    expect(mock).toHaveBeenCalledTimes(0);
  });

  it('maps lifetimeEvents and lifetimeUsers headers to more human readable', async function () {
    MemberListStore.loadInitialData([user]);
    render(
      <WidgetCard
        api={api}
        organization={organization}
        widget={{
          ...widget,
          queries: [
            {
              ...widget.queries[0]!,
              fields: ['issue', 'assignee', 'title', 'lifetimeEvents', 'lifetimeUsers'],
            },
          ],
        }}
        selection={selection}
        isEditingDashboard={false}
        onDelete={() => undefined}
        onEdit={() => undefined}
        onDuplicate={() => undefined}
        renderErrorMessage={() => undefined}
        showContextMenu
        widgetLimitReached={false}
        widgetLegendState={widgetLegendState}
      />,
      {wrapper: Wrapper}
    );

    expect(await screen.findByText('Lifetime Events')).toBeInTheDocument();
    expect(screen.getByText('Lifetime Users')).toBeInTheDocument();
  });
});
