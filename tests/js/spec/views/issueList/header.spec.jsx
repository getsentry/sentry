import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import IssueListHeader from 'sentry/views/issueList/header';
import {Query} from 'sentry/views/issueList/utils';

jest.mock('sentry/utils/analytics', () => ({
  trackAnalyticsEvent: jest.fn(),
}));

const queryCounts = {
  'is:unresolved is:for_review assigned_or_suggested:[me, none]': {
    count: 22,
    hasMore: false,
  },
  'is:unresolved': {
    count: 1,
    hasMore: false,
  },
  'is:ignored': {
    count: 0,
    hasMore: false,
  },
  'is:reprocessing': {
    count: 0,
    hasMore: false,
  },
};

const queryCountsMaxed = {
  'is:unresolved is:for_review assigned_or_suggested:[me, none]': {
    count: 321,
    hasMore: false,
  },
  'is:unresolved': {
    count: 100,
    hasMore: true,
  },
  'is:ignored': {
    count: 100,
    hasMore: true,
  },
};

describe('IssueListHeader', () => {
  let organization;
  beforeEach(() => {
    organization = TestStubs.Organization();
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('renders active tab with count when query matches inbox', () => {
    render(
      <IssueListHeader
        organization={organization}
        query="is:unresolved is:for_review assigned_or_suggested:[me, none]"
        queryCount={0}
        queryCounts={queryCounts}
        projectIds={[]}
        savedSearchList={[]}
      />
    );

    expect(screen.getByText('For Review')).toHaveTextContent('For Review 22');
  });

  it('renders reprocessing tab', () => {
    organization.features = ['reprocessing-v2'];
    render(
      <IssueListHeader
        organization={organization}
        query=""
        queryCount={0}
        queryCounts={{
          ...queryCounts,
          'is:reprocessing': {
            count: 1,
            hasMore: false,
          },
        }}
        displayReprocessingTab
        projectIds={[]}
        savedSearchList={[]}
      />
    );
    expect(screen.getByText('Reprocessing')).toHaveTextContent('Reprocessing 1');
  });

  it("renders all tabs inactive when query doesn't match", () => {
    render(
      <IssueListHeader
        organization={organization}
        query=""
        queryCounts={queryCounts}
        projectIds={[]}
        savedSearchList={[]}
      />
    );
    expect(screen.getByText('Custom Search')).toBeInTheDocument();
  });

  it('renders all tabs with counts', () => {
    render(
      <IssueListHeader
        organization={organization}
        query=""
        queryCount={0}
        queryCounts={queryCounts}
        projectIds={[]}
        savedSearchList={[]}
      />
    );
    const tabs = screen.getAllByRole('listitem');
    expect(tabs[0]).toHaveTextContent('All Unresolved 1');
    expect(tabs[1]).toHaveTextContent('For Review 22');
    expect(tabs[2]).toHaveTextContent('Ignored');
  });

  it('renders limited counts for tabs and exact for selected', () => {
    render(
      <IssueListHeader
        organization={organization}
        query=""
        queryCount={0}
        queryCounts={queryCountsMaxed}
        projectIds={[]}
        savedSearchList={[]}
      />
    );
    const tabs = screen.getAllByRole('listitem');
    expect(tabs[0]).toHaveTextContent('All Unresolved 99+');
    expect(tabs[1]).toHaveTextContent('For Review 321');
    expect(tabs[2]).toHaveTextContent('Ignored 99+');
  });

  it('transitions to new query on tab click', () => {
    const routerContext = TestStubs.routerContext();

    render(
      <IssueListHeader
        organization={organization}
        queryCounts={queryCounts}
        projectIds={[]}
        savedSearchList={[]}
      />,
      {context: routerContext}
    );
    const pathname = '/organizations/org-slug/issues/';
    userEvent.click(screen.getByText('All Unresolved'));
    expect(routerContext.context.router.push).toHaveBeenCalledWith({
      pathname,
      query: {query: 'is:unresolved'},
    });

    userEvent.click(screen.getByText('For Review'));
    expect(routerContext.context.router.push).toHaveBeenCalledWith({
      pathname,
      query: {
        query: 'is:unresolved is:for_review assigned_or_suggested:[me, none]',
        sort: 'inbox',
      },
    });
  });

  it('removes inbox sort for non-inbox tabs', () => {
    const routerContext = TestStubs.routerContext();
    render(
      <IssueListHeader
        organization={organization}
        queryCounts={queryCounts}
        projectIds={[]}
        savedSearchList={[]}
        router={TestStubs.router({
          location: {
            pathname: '/test/',
            query: {sort: 'inbox'},
          },
        })}
      />,
      {context: routerContext}
    );
    const pathname = '/organizations/org-slug/issues/';
    userEvent.click(screen.getByText('All Unresolved'));
    expect(routerContext.context.router.push).toHaveBeenCalledWith({
      pathname,
      query: {query: 'is:unresolved'},
    });

    userEvent.click(screen.getByText('For Review'));
    expect(routerContext.context.router.push).toHaveBeenCalledWith({
      pathname,
      query: {
        query: 'is:unresolved is:for_review assigned_or_suggested:[me, none]',
        sort: 'inbox',
      },
    });
  });

  it('changes sort for inbox tab', () => {
    const routerContext = TestStubs.routerContext();
    render(
      <IssueListHeader
        organization={organization}
        queryCounts={queryCounts}
        projectIds={[]}
        savedSearchList={[]}
        router={TestStubs.router({
          location: {
            pathname: '/test/',
            query: {sort: 'date'},
          },
        })}
      />,
      {context: routerContext}
    );

    userEvent.click(screen.getByText('For Review'));
    expect(routerContext.context.router.push).toHaveBeenCalledWith({
      pathname: '/organizations/org-slug/issues/',
      query: {
        query: 'is:unresolved is:for_review assigned_or_suggested:[me, none]',
        sort: 'inbox',
      },
    });
  });

  it('tracks clicks on inbox tab', () => {
    render(
      <IssueListHeader
        organization={organization}
        query={Query.UNRESOLVED}
        queryCounts={queryCounts}
        projectIds={[]}
        savedSearchList={[]}
      />,
      {context: TestStubs.routerContext()}
    );
    userEvent.click(screen.getByText('For Review'));
    expect(trackAnalyticsEvent).toHaveBeenCalledTimes(1);
  });

  it('ignores clicks on inbox tab when already on inbox tab', () => {
    render(
      <IssueListHeader
        organization={organization}
        query={Query.FOR_REVIEW}
        queryCounts={queryCounts}
        projectIds={[]}
        savedSearchList={[]}
      />,
      {context: TestStubs.routerContext()}
    );
    userEvent.click(screen.getByText('For Review'));
    expect(trackAnalyticsEvent).toHaveBeenCalledTimes(0);
  });

  it('should indicate when query is a custom search and display count', () => {
    render(
      <IssueListHeader
        organization={organization}
        queryCounts={queryCounts}
        projectIds={[]}
        savedSearchList={[]}
        query="not a saved search"
        queryCount={13}
      />
    );
    expect(screen.getByRole('button', {name: 'Custom Search 13'})).toBeInTheDocument();
  });

  it('should display saved search name and count', () => {
    const query = 'saved search query';
    render(
      <IssueListHeader
        organization={organization}
        queryCounts={queryCounts}
        projectIds={[]}
        savedSearchList={[
          {
            id: '789',
            query,
            name: 'Saved Search',
            isPinned: false,
            isGlobal: true,
          },
        ]}
        query={query}
        queryCount={13}
      />
    );
    expect(screen.getByRole('button', {name: 'Saved Search 13'})).toBeInTheDocument();
  });

  it('lists saved searches in dropdown', () => {
    render(
      <IssueListHeader
        organization={organization}
        queryCounts={queryCounts}
        projectIds={[]}
        savedSearchList={[
          {
            id: '789',
            query: 'is:unresolved TypeError',
            name: 'Unresolved TypeError',
            isPinned: false,
            isGlobal: true,
          },
        ]}
        query="is:unresolved"
      />
    );
    expect(screen.queryByText('Unresolved TypeError')).not.toBeInTheDocument();
    userEvent.click(screen.getByText('Saved Searches'));
    expect(screen.getByText('Unresolved TypeError')).toBeInTheDocument();
  });
});
