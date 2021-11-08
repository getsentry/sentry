// import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';
import {fireEvent, mountWithTheme, screen} from 'sentry-test/reactTestingLibrary';

import DashboardWidgetLibraryModal from 'app/components/modals/dashboardWidgetLibraryModal';

const stubEl = props => <div>{props.children}</div>;

function mountModal({initialData}) {
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

  it('renders the widget library modal', function () {
    // Checking initial modal states
    const container = mountModal({initialData});
    expect(screen.getByText('6 WIDGETS')).toBeInTheDocument();
    expect(screen.getByTestId('selected-badge')).toHaveTextContent('0 Selected');
    expect(screen.queryAllByText('Select')).toHaveLength(6);
    expect(screen.queryByText('Selected')).not.toBeInTheDocument();

    // Select some widgets
    const selectButtons = screen.getAllByRole('button');
    fireEvent.click(selectButtons[4]);
    fireEvent.click(selectButtons[5]);

    expect(screen.getByTestId('selected-badge')).toHaveTextContent('2 Selected');
    expect(screen.queryAllByText('Select')).toHaveLength(4);
    expect(screen.queryAllByText('Selected')).toHaveLength(2);

    container.unmount();
  });
});
