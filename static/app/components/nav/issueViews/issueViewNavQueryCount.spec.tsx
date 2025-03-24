import {render, screen} from 'sentry-test/reactTestingLibrary';

import {IssueViewNavQueryCount} from 'sentry/components/nav/issueViews/issueViewNavQueryCount';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

describe('IssueViewNavQueryCount', () => {
  const mockView = {
    id: '1',
    name: 'Test View',
    query: 'is:unresolved',
    querySort: IssueSortOptions.DATE,
    environments: ['37'],
    projects: [73],
    timeFilters: {
      period: '1d',
      start: null,
      end: null,
      utc: null,
    },
    isCommitted: true,
    key: 'test-view',
    label: 'Test View',
  };

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('should render the precise query count if its under 100', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues-count/',
      method: 'GET',
      body: {
        'is:unresolved': 71,
      },
    });

    render(<IssueViewNavQueryCount view={mockView} />);

    expect(await screen.findByText('71')).toBeInTheDocument();
  });

  it('should render the "99+" if the count is over 100', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues-count/',
      method: 'GET',
      body: {
        'is:unresolved': 101,
      },
    });

    render(<IssueViewNavQueryCount view={mockView} />);

    expect(await screen.findByText('99+')).toBeInTheDocument();
  });
});
