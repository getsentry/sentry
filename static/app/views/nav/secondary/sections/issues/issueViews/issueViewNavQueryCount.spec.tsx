import {render, screen} from 'sentry-test/reactTestingLibrary';

import {IssueSortOptions} from 'sentry/views/issueList/utils';
import {IssueViewNavQueryCount} from 'sentry/views/nav/secondary/sections/issues/issueViews/issueViewNavQueryCount';

describe('IssueViewNavQueryCount', () => {
  const mockView = {
    id: '1',
    label: 'Test View',
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
    lastVisited: null,
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

    render(<IssueViewNavQueryCount view={mockView} isActive />);

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

    render(<IssueViewNavQueryCount view={mockView} isActive />);

    expect(await screen.findByText('99+')).toBeInTheDocument();
  });
});
