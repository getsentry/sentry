import {GroupSearchViewFixture} from 'sentry-fixture/groupSearchView';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/components/pageFilters/store';
import IssueListContainer from 'sentry/views/issueList';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

describe('IssueListContainer', () => {
  const defaultProps = {
    children: <div>Foo</div>,
  };

  const organization = OrganizationFixture();

  const initialRouterConfig = {
    location: {
      pathname: '/organizations/org-slug/issues/views/100/',
    },
    route: '/organizations/:orgId/issues/views/:viewId/',
  };

  const mockGroupSearchView = GroupSearchViewFixture({id: '100'});

  describe('issue views', () => {
    beforeEach(() => {
      PageFiltersStore.init();
      PageFiltersStore.onInitializeUrlState({
        projects: [],
        environments: [],
        datetime: {start: null, end: null, period: '14d', utc: null},
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/group-search-views/100/',
        body: mockGroupSearchView,
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/group-search-views/100/visit/',
        method: 'POST',
      });
    });

    it('marks the current issue view as seen', async () => {
      const mockUpdateLastVisited = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/group-search-views/100/visit/',
        method: 'POST',
        body: {},
      });

      render(<IssueListContainer {...defaultProps} />, {
        organization,
        initialRouterConfig,
      });

      await screen.findByText('Foo');

      expect(mockUpdateLastVisited).toHaveBeenCalledTimes(1);
    });

    it('hydrates issue view query params', async () => {
      const {router} = render(<IssueListContainer {...defaultProps} />, {
        organization,

        initialRouterConfig,
      });

      await screen.findByText('Foo');

      await waitFor(() => {
        expect(router.location.query).toEqual({
          project: '1',
          environment: 'prod',
          sort: IssueSortOptions.DATE,
          statsPeriod: '7d',
          query: 'is:unresolved',
        });
      });
    });
  });
});
