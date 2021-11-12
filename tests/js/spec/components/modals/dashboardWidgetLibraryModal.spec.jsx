import {initializeOrg} from 'sentry-test/initializeOrg';
import {mountWithTheme, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import DashboardWidgetLibraryModal from 'app/components/modals/dashboardWidgetLibraryModal';

const stubEl = props => <div>{props.children}</div>;
const alertText =
  'Please select at least one Widget from our Library. Alternatively, you can build a custom widget from scratch.';

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

  it('selects and unselcts widgets correctly', function () {
    // Checking initial modal states
    const container = mountModal({initialData});
    expect(screen.getByText('6 WIDGETS')).toBeInTheDocument();
    expect(screen.getByTestId('selected-badge')).toHaveTextContent('0 Selected');
    expect(screen.queryAllByText('Select')).toHaveLength(6);
    expect(screen.queryByText('Selected')).not.toBeInTheDocument();

    // Select some widgets
    const selectButtons = screen.getAllByRole('button');
    userEvent.click(selectButtons[3]);
    userEvent.click(selectButtons[4]);
    userEvent.click(selectButtons[5]);

    expect(screen.getByTestId('selected-badge')).toHaveTextContent('3 Selected');
    expect(screen.queryAllByText('Select')).toHaveLength(3);
    expect(screen.queryAllByText('Selected')).toHaveLength(3);

    // Deselect a widget
    userEvent.click(selectButtons[4]);
    expect(screen.getByTestId('selected-badge')).toHaveTextContent('2 Selected');
    expect(screen.queryAllByText('Select')).toHaveLength(4);
    expect(screen.queryAllByText('Selected')).toHaveLength(2);

    container.unmount();
  });
  it('submits selected widgets correctly', function () {
    // Checking initial modal states
    const mockApply = jest.fn();
    const closeModal = jest.fn();
    const container = mountModal({initialData}, mockApply, closeModal);
    // Select some widgets
    const selectButtons = screen.getAllByRole('button');
    userEvent.click(selectButtons[3]);

    expect(screen.getByTestId('selected-badge')).toHaveTextContent('1 Selected');
    userEvent.click(screen.getByTestId('confirm-widgets'));

    expect(mockApply).toHaveBeenCalledTimes(1);
    expect(mockApply).toHaveBeenCalledWith([
      {
        displayType: 'area',
        id: undefined,
        interval: '5m',
        queries: [
          {
            conditions: '!event.type:transaction',
            fields: ['count()'],
            name: '',
            orderby: '',
          },
        ],
        title: 'All Events',
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

    expect(screen.getByTestId('selected-badge')).toHaveTextContent('0 Selected');
    userEvent.click(screen.getByTestId('confirm-widgets'));

    expect(mockApply).toHaveBeenCalledTimes(0);
    expect(closeModal).toHaveBeenCalledTimes(0);
    expect(screen.getByText(alertText)).toBeInTheDocument();

    container.unmount();
  });
});
