import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import {useLocation} from 'sentry/utils/useLocation';
import usePageFilters from 'sentry/utils/usePageFilters';
import {PagePerformanceTable} from 'sentry/views/insights/browser/webVitals/components/tables/pagePerformanceTable';

jest.mock('sentry/utils/useLocation');
jest.mock('sentry/utils/usePageFilters');

describe('PagePerformanceTable', function () {
  const organization = OrganizationFixture();

  let eventsMock;

  beforeEach(function () {
    jest.mocked(useLocation).mockReturnValue({
      pathname: '',
      search: '',
      query: {},
      hash: '',
      state: undefined,
      action: 'PUSH',
      key: '',
    });
    jest.mocked(usePageFilters).mockReturnValue({
      isReady: true,
      desyncedFilters: new Set(),
      pinnedFilters: new Set(),
      shouldPersist: true,
      selection: {
        datetime: {
          period: '10d',
          start: null,
          end: null,
          utc: false,
        },
        environments: [],
        projects: [],
      },
    });
    eventsMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/events/`,
      body: {
        data: [],
      },
    });
  });

  afterEach(function () {
    jest.clearAllMocks();
  });

  it('escapes user input search filter', async () => {
    jest.mocked(useLocation).mockReturnValue({
      pathname: '',
      search: '',
      query: {query: '/issues/*'},
      hash: '',
      state: undefined,
      action: 'PUSH',
      key: '',
    });
    render(<PagePerformanceTable />, {organization});
    await waitFor(() => {
      expect(eventsMock).toHaveBeenCalledTimes(2);
      expect(eventsMock).toHaveBeenLastCalledWith(
        '/organizations/org-slug/events/',
        expect.objectContaining({
          query: expect.objectContaining({
            query: expect.stringContaining('transaction:"*/issues/\\**"'),
          }),
        })
      );
    });
  });
});
