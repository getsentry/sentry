import type {Location} from 'history';
import {DashboardFixture} from 'sentry-fixture/dashboard';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';
import {WidgetFixture} from 'sentry-fixture/widget';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import TextWidgetViewerModal from 'sentry/components/modals/textWidgetViewerModal';
import PageFiltersStore from 'sentry/components/pageFilters/store';
import ConfigStore from 'sentry/stores/configStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import {DisplayType} from 'sentry/views/dashboards/types';
import type {DashboardPermissions, Widget} from 'sentry/views/dashboards/types';
import WidgetLegendSelectionState from 'sentry/views/dashboards/widgetLegendSelectionState';

jest.mock('sentry/utils/analytics');

jest.mock('sentry/views/dashboards/widgetCard/widgetCardChartContainer', () => ({
  WidgetCardChartContainer: jest.fn(() => <div data-test-id="widget-chart" />),
}));

const stubEl = (props: {children?: React.ReactNode}) => <div>{props.children}</div>;

function renderModal({
  widget = WidgetFixture({
    displayType: DisplayType.TEXT,
    id: '1',
    title: 'My Text Widget',
  }),
  onEdit,
  closeModal = jest.fn(),
  dashboardPermissions,
  dashboardCreator,
  organization = OrganizationFixture(),
  routerQuery = {},
}: {
  closeModal?: jest.Mock;
  dashboardCreator?: ReturnType<typeof UserFixture>;
  dashboardPermissions?: DashboardPermissions;
  onEdit?: jest.Mock;
  organization?: ReturnType<typeof OrganizationFixture>;
  routerQuery?: Record<string, string>;
  widget?: Widget;
} = {}) {
  const widgetLegendLocation = {
    pathname: '/mock-pathname/',
    query: routerQuery,
    hash: '',
    search: '',
    state: undefined,
    key: 'initial',
  } as Location;

  const widgetLegendState = new WidgetLegendSelectionState({
    location: widgetLegendLocation,
    dashboard: DashboardFixture([widget], {id: 'new', title: 'Dashboard'}),
    organization,
    navigate: jest.fn(),
  });

  return render(
    <TextWidgetViewerModal
      Header={stubEl}
      Footer={stubEl as ModalRenderProps['Footer']}
      Body={stubEl as ModalRenderProps['Body']}
      CloseButton={stubEl}
      closeModal={closeModal}
      organization={organization}
      widget={widget}
      widgetLegendState={widgetLegendState}
      onEdit={onEdit}
      dashboardPermissions={dashboardPermissions}
      dashboardCreator={dashboardCreator}
    />,
    {
      organization,
      initialRouterConfig: {
        location: {pathname: '/mock-pathname/', query: routerQuery},
      },
    }
  );
}

describe('Modals -> TextWidgetViewerModal', () => {
  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/user-teams/',
      body: [],
    });

    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [],
      environments: [],
      datetime: {start: null, end: null, period: '14d', utc: null},
    });

    ConfigStore.set('user', UserFixture({id: '1'}));
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('renders the widget title', async () => {
    renderModal();

    expect(await screen.findByText('My Text Widget')).toBeInTheDocument();
  });

  it('renders the chart container', async () => {
    renderModal();

    expect(await screen.findByTestId('widget-chart')).toBeInTheDocument();
  });

  describe('Edit button', () => {
    it('shows edit button when onEdit and widget.id are provided', async () => {
      renderModal({onEdit: jest.fn()});

      expect(
        await screen.findByRole('button', {name: 'Edit Widget'})
      ).toBeInTheDocument();
    });

    it('does not show edit button when onEdit is not provided', () => {
      renderModal();

      expect(screen.queryByRole('button', {name: 'Edit Widget'})).not.toBeInTheDocument();
    });

    it('does not show edit button when widget has no id', () => {
      renderModal({
        widget: WidgetFixture({displayType: DisplayType.TEXT, title: 'No ID Widget'}),
        onEdit: jest.fn(),
      });

      expect(screen.queryByRole('button', {name: 'Edit Widget'})).not.toBeInTheDocument();
    });

    it('calls closeModal, onEdit, and tracks analytics on click', async () => {
      const closeModal = jest.fn();
      const onEdit = jest.fn();

      renderModal({closeModal, onEdit});

      await userEvent.click(await screen.findByRole('button', {name: 'Edit Widget'}));

      expect(closeModal).toHaveBeenCalled();
      expect(onEdit).toHaveBeenCalled();
      expect(trackAnalytics).toHaveBeenCalledWith(
        'dashboards_views.widget_viewer.edit',
        expect.objectContaining({
          display_type: DisplayType.TEXT,
        })
      );
    });

    it('is disabled when user does not have edit access', async () => {
      // Use an org without org:admin so hasEveryAccess returns false
      renderModal({
        organization: OrganizationFixture({access: []}),
        onEdit: jest.fn(),
        dashboardPermissions: {isEditableByEveryone: false},
        dashboardCreator: UserFixture({id: '999'}),
      });

      expect(await screen.findByRole('button', {name: 'Edit Widget'})).toBeDisabled();
    });

    it('is enabled when user is the dashboard creator', async () => {
      renderModal({
        onEdit: jest.fn(),
        dashboardPermissions: {isEditableByEveryone: false},
        dashboardCreator: UserFixture({id: '1'}), // matches ConfigStore user
      });

      expect(await screen.findByRole('button', {name: 'Edit Widget'})).toBeEnabled();
    });

    it('is enabled when dashboard is editable by everyone', async () => {
      renderModal({
        onEdit: jest.fn(),
        dashboardPermissions: {isEditableByEveryone: true},
      });

      expect(await screen.findByRole('button', {name: 'Edit Widget'})).toBeEnabled();
    });
  });
});
