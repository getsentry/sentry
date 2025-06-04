import {GroupSearchViewFixture} from 'sentry-fixture/groupSearchView';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import IssueListContainer from 'sentry/views/issueList';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

describe('IssueListContainer', function () {
  const defaultProps = {
    children: <div>Foo</div>,
  };

  const organization = OrganizationFixture({
    features: ['enforce-stacked-navigation'],
  });

  const user = UserFixture();
  user.options.prefersStackedNavigation = true;

  const initialRouterConfig = {
    location: {
      pathname: '/organizations/org-slug/issues/views/100/',
    },
    route: '/organizations/:orgId/issues/views/:viewId/',
  };

  const mockGroupSearchView = GroupSearchViewFixture({id: '100'});

  describe('issue views', function () {
    beforeEach(function () {
      PageFiltersStore.init();
      PageFiltersStore.onInitializeUrlState(
        {
          projects: [],
          environments: [],
          datetime: {start: null, end: null, period: '14d', utc: null},
        },
        new Set(['projects'])
      );
      ConfigStore.set('user', user);

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/group-search-views/100/',
        body: mockGroupSearchView,
      });

      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/group-search-views/100/visit/',
        method: 'POST',
      });
    });

    it('marks the current issue view as seen', async function () {
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

    it('hydrates issue view query params', async function () {
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
