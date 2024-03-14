import {render, screen} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import {HTTPSamplesPanel} from 'sentry/views/performance/http/httpSamplesPanel';

jest.mock('sentry/utils/useLocation');

describe('HTTPSamplesPanel', function () {
  jest.mocked(useLocation).mockReturnValue({
    pathname: '',
    search: '',
    query: {
      domain: '*.sentry.dev',
      statsPeriod: '10d',
      transaction: '/api/0/users',
      transactionMethod: 'GET',
    },
    hash: '',
    state: undefined,
    action: 'PUSH',
    key: '',
  });

  afterAll(function () {
    jest.resetAllMocks();
  });

  it('show basic transaction info', function () {
    render(<HTTPSamplesPanel />);

    expect(screen.getByRole('heading', {name: 'GET /api/0/users'})).toBeInTheDocument();
  });
});
