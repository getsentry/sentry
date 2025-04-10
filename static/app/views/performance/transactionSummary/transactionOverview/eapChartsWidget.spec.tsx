import {LocationFixture} from 'sentry-fixture/locationFixture';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

import {EAPChartsWidget} from './eapChartsWidget';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/useNavigate');
jest.mock(
  'sentry/views/performance/transactionSummary/transactionOverview/useWidgetChartVisualization'
);

const mockUseLocation = useLocation as jest.MockedFunction<typeof useLocation>;
const mockUseNavigate = useNavigate as jest.MockedFunction<typeof useNavigate>;

describe('EAPChartsWidget', function () {
  const transactionName = 'test-transaction';
  const mockNavigate = jest.fn();

  beforeEach(() => {
    mockUseLocation.mockImplementation(() => LocationFixture());
    mockUseNavigate.mockImplementation(() => mockNavigate);
  });

  afterEach(() => {
    jest.clearAllMocks();
    mockNavigate.mockClear();
  });

  it('shows default widget type when no query param is provided', function () {
    render(<EAPChartsWidget transactionName={transactionName} />);

    // Default widget type should be DURATION_BREAKDOWN
    expect(screen.getByText('Duration Breakdown')).toBeInTheDocument();
  });

  it('shows default widget when invalid query param is provided', function () {
    mockUseLocation.mockImplementation(() =>
      LocationFixture({
        query: {
          chartDisplay: 'some_widget_that_does_not_exist',
        },
        pathname: '/test',
      })
    );

    render(<EAPChartsWidget transactionName={transactionName} />);

    // Should fallback to DURATION_BREAKDOWN
    expect(screen.getByText('Duration Breakdown')).toBeInTheDocument();
  });
});
