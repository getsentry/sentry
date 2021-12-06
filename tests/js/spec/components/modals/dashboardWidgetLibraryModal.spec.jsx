import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openAddDashboardWidgetModal} from 'sentry/actionCreators/modal';
import DashboardWidgetLibraryModal from 'sentry/components/modals/dashboardWidgetLibraryModal';

const stubEl = props => <div>{props.children}</div>;
const alertText =
  'Please select at least one Widget from our Library. Alternatively, you can build a custom widget from scratch.';

jest.mock('sentry/actionCreators/modal', () => ({
  openAddDashboardWidgetModal: jest.fn(),
}));

function mountModal({initialData}, onApply, closeModal) {
  const routerContext = TestStubs.routerContext();
  return mountWithTheme(
    <DashboardWidgetLibraryModal
      Header={stubEl}
      Footer={stubEl}
      Body={stubEl}
      organization={initialData.organization}
      dashboard={TestStubs.Dashboard([], {
        id: '1',
        title: 'Dashboard 1',
        dateCreated: '2021-04-19T13:13:23.962105Z',
        createdBy: {id: '1'},
        widgetDisplay: [],
      })}
      onAddWidget={onApply}
      closeModal={closeModal}
    />,
    {context: routerContext}
  );
}

describe('Modals -> DashboardWidgetLibraryModal', function () {
  const initialData = initializeOrg({
    organization: {
      features: ['widget-library'],
      apdexThreshold: 400,
    },
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('opens modal and renders correctly', async function () {
    // Checking initial modal states
    const container = mountModal({initialData});

    expect(screen.queryByText('All Events')).toBeInTheDocument();
    expect(screen.queryByText('Total Errors')).toBeInTheDocument();
    expect(screen.queryByText('Affected Users')).toBeInTheDocument();
    expect(screen.queryByText('Handled vs. Unhandled')).toBeInTheDocument();
    expect(screen.queryByText('Errors by Country')).toBeInTheDocument();
    expect(screen.queryByText('Errors by Browser')).toBeInTheDocument();

    expect(
      screen.getByRole('button', {name: 'Widget Library', current: true})
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', {name: 'Custom Widget', current: false})
    ).toBeInTheDocument();

    const button = screen.getByRole('button', {name: 'Custom Widget'});
    userEvent.click(button);

    expect(openAddDashboardWidgetModal).toHaveBeenCalledTimes(1);

    container.unmount();
  });

  it('submits selected widgets', function () {
    // Checking initial modal states
    const mockApply = jest.fn();
    const closeModal = jest.fn();
    const container = mountModal({initialData}, mockApply, closeModal);

    // Select some widgets
    const allEvents = screen.queryByText('All Events');
    userEvent.click(allEvents);

    userEvent.click(screen.getByTestId('confirm-widgets'));

    expect(mockApply).toHaveBeenCalledTimes(1);
    expect(mockApply).toHaveBeenCalledWith([
      {
        displayType: 'area',
        id: undefined,
        interval: '5m',
        description: 'Area chart reflecting all error and transaction events.',
        queries: [
          {
            conditions: '!event.type:transaction',
            fields: ['count()'],
            name: '',
            orderby: '',
          },
        ],
        title: 'All Events',
        widgetType: 'discover',
      },
    ]);
    expect(closeModal).toHaveBeenCalledTimes(1);

    container.unmount();
  });

  it('raises warning if widget not selected', function () {
    // Checking initial modal states
    const mockApply = jest.fn();
    const closeModal = jest.fn();
    const container = mountModal({initialData}, mockApply, closeModal);
    expect(screen.queryByText(alertText)).not.toBeInTheDocument();

    userEvent.click(screen.getByTestId('confirm-widgets'));

    expect(mockApply).toHaveBeenCalledTimes(0);
    expect(closeModal).toHaveBeenCalledTimes(0);
    expect(screen.getByText(alertText)).toBeInTheDocument();

    container.unmount();
  });
});
