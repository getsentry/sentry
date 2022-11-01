import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import TagStore from 'sentry/stores/tagStore';

import IssueListFilters from './filters';

describe('IssueListFilters', function () {
  const {organization, routerContext} = initializeOrg();
  const defaultProps = {
    isSearchDisabled: false,
    organization,
    query: '',
    onSearch: jest.fn(),
    sort: 'date',
    savedSearch: null,
  };

  beforeEach(function () {
    TagStore.reset();
    TagStore.loadTagsSuccess(TestStubs.Tags());

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'GET',
      body: [],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  describe('Pinned Searches', function () {
    let pinSearch;
    let unpinSearch;

    beforeEach(function () {
      MockApiClient.clearMockResponses();
      pinSearch = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/pinned-searches/',
        method: 'PUT',
        body: {},
      });
      unpinSearch = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/pinned-searches/',
        method: 'DELETE',
        body: {},
      });
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/recent-searches/',
        method: 'GET',
        body: [],
      });
    });

    it('has pin icon', function () {
      render(<IssueListFilters {...defaultProps} />, {context: routerContext});

      expect(screen.getByTestId('pin-icon')).toBeInTheDocument();
    });

    it('pins a search from the searchbar', function () {
      render(<IssueListFilters {...defaultProps} query='url:"fu"' />, {
        context: routerContext,
      });

      userEvent.click(screen.getByRole('button', {name: 'Pin this search'}));

      expect(pinSearch).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          method: 'PUT',
          data: {
            query: 'url:"fu"',
            sort: 'date',
            type: 0,
          },
        })
      );
    });

    it('unpins a search from the searchbar', function () {
      render(
        <IssueListFilters
          {...defaultProps}
          query='url:"fu"'
          savedSearch={{
            id: '1',
            name: 'Saved Search',
            isPinned: true,
            query: 'url:"fu"',
            sort: 'date',
            dateCreated: '',
            isOrgCustom: false,
            isGlobal: false,
            type: 0,
          }}
        />,
        {context: routerContext}
      );

      userEvent.click(screen.getByRole('button', {name: 'Unpin this search'}));

      expect(unpinSearch).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          method: 'DELETE',
          data: {
            type: 0,
          },
        })
      );
    });
  });
});
