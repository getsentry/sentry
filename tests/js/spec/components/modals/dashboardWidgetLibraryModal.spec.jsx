import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openAddDashboardWidgetModal} from 'sentry/actionCreators/modal';
import DashboardWidgetLibraryModal from 'sentry/components/modals/dashboardWidgetLibraryModal';
import * as types from 'sentry/views/dashboardsV2/types';

const stubEl = props => <div>{props.children}</div>;
const alertText =
  'Please select at least one Widget from our Library. Alternatively, you can build a custom widget from scratch.';

jest.mock('sentry/actionCreators/modal', () => ({
  openAddDashboardWidgetModal: jest.fn(),
}));

function mountModal({initialData}, onApply, closeModal, widgets = []) {
  return mountWithTheme(
    <DashboardWidgetLibraryModal
      Header={stubEl}
      Footer={stubEl}
      Body={stubEl}
      organization={initialData.organization}
      dashboard={TestStubs.Dashboard(widgets, {
        id: '1',
        title: 'Dashboard 1',
        dateCreated: '2021-04-19T13:13:23.962105Z',
        createdBy: {id: '1'},
        widgetDisplay: [],
      })}
      onAddWidget={onApply}
      closeModal={closeModal}
    />
  );
}

describe('Modals -> DashboardWidgetLibraryModal', function () {
  const initialData = initializeOrg({
    organization: {
      features: ['widget-library'],
      apdexThreshold: 400,
    },
  });
  let container;

  afterEach(() => {
    MockApiClient.clearMockResponses();
    if (container) {
      container.unmount();
    }
  });

  it('opens modal and renders correctly', async function () {
    // Checking initial modal states
    container = mountModal({initialData});

    expect(screen.getByText('Duration Distribution')).toBeInTheDocument();
    expect(screen.getByText('High Throughput Transactions')).toBeInTheDocument();
    expect(screen.getByText('LCP by Country')).toBeInTheDocument();
    expect(screen.getByText('Miserable Users')).toBeInTheDocument();
    expect(screen.getByText('Slow vs. Fast Transactions')).toBeInTheDocument();
    expect(screen.getByText('Issues For Review')).toBeInTheDocument();
    expect(screen.getByText('Top Unhandled Error Types')).toBeInTheDocument();
    expect(screen.getByText('Users Affected by Errors')).toBeInTheDocument();

    expect(screen.getByRole('button', {name: 'Widget Library new'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Custom Widget'})).toBeInTheDocument();

    const button = screen.getByRole('button', {name: 'Custom Widget'});
    userEvent.click(button);

    expect(openAddDashboardWidgetModal).toHaveBeenCalledTimes(1);
  });

  it('submits selected widgets', function () {
    // Checking initial modal states
    const mockApply = jest.fn();
    const closeModal = jest.fn();
    container = mountModal({initialData}, mockApply, closeModal, [
      TestStubs.Widget(
        [{name: '', orderby: '', conditions: 'event.type:error', fields: ['count()']}],
        {
          title: 'Errors',
          interval: '1d',
          id: '1',
          displayType: 'line',
        }
      ),
    ]);

    // Select some widgets
    const allEvents = screen.queryByText('High Throughput Transactions');
    userEvent.click(allEvents);

    expect(screen.getByTestId('confirm-widgets')).toBeEnabled();
    userEvent.click(screen.getByTestId('confirm-widgets'));

    expect(mockApply).toHaveBeenCalledTimes(1);
    expect(mockApply).toHaveBeenCalledWith([
      expect.objectContaining({
        displayType: 'line',
        id: '1',
        interval: '1d',
        queries: [
          {
            conditions: 'event.type:error',
            fields: ['count()'],
            name: '',
            orderby: '',
          },
        ],
        title: 'Errors',
      }),
      expect.objectContaining({
        displayType: 'top_n',
        id: undefined,
        interval: '5m',
        description: 'Top 5 transactions with the largest volume.',
        queries: [
          {
            conditions: 'event.type:transaction',
            fields: ['transaction', 'count()'],
            name: '',
            orderby: '-count',
          },
        ],
        title: 'High Throughput Transactions',
        widgetType: 'discover',
      }),
    ]);
    expect(closeModal).toHaveBeenCalledTimes(1);
  });

  it('raises warning if widget not selected', function () {
    // Checking initial modal states
    const mockApply = jest.fn();
    const closeModal = jest.fn();
    container = mountModal({initialData}, mockApply, closeModal);
    expect(screen.queryByText(alertText)).not.toBeInTheDocument();

    userEvent.click(screen.getByTestId('confirm-widgets'));

    expect(mockApply).toHaveBeenCalledTimes(0);
    expect(closeModal).toHaveBeenCalledTimes(0);
    expect(screen.getByText(alertText)).toBeInTheDocument();
  });

  it('disables save button if widget limit is exceeded', function () {
    // Checking initial modal states
    const mockApply = jest.fn();
    const closeModal = jest.fn();
    types.MAX_WIDGETS = 1;
    container = mountModal({initialData}, mockApply, closeModal);

    // Select some widgets
    const allEvents = screen.queryByText('High Throughput Transactions');
    userEvent.click(allEvents);

    const totalErrors = screen.queryByText('Users Affected by Errors');
    userEvent.click(totalErrors);

    expect(screen.getByTestId('confirm-widgets')).toBeDisabled();
  });
});
