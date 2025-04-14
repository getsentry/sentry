import {LocationFixture} from 'sentry-fixture/locationFixture';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';

import {EAPChartsWidget} from './eapChartsWidget';

jest.mock('sentry/utils/useLocation');

const mockUseLocation = useLocation as jest.MockedFunction<typeof useLocation>;

describe('EAPChartsWidget', function () {
  const transactionName = 'test-transaction';

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    mockUseLocation.mockImplementation(() => LocationFixture());

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/stats/',
      body: [],
      status: 200,
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    MockApiClient.clearMockResponses();
  });

  it('shows default widget type when no query param is provided', async function () {
    render(<EAPChartsWidget transactionName={transactionName} query={''} />);

    await waitFor(() => {
      expect(screen.getByText('Duration Breakdown')).toBeInTheDocument();
    });
  });

  it('shows default widget when invalid query param is provided', async function () {
    mockUseLocation.mockImplementation(() =>
      LocationFixture({
        query: {
          chartDisplay: 'some_widget_that_does_not_exist',
        },
        pathname: '/test',
      })
    );

    render(<EAPChartsWidget transactionName={transactionName} query={''} />);

    await waitFor(() => {
      expect(screen.getByText('Duration Breakdown')).toBeInTheDocument();
    });
  });
});
