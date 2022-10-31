import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import TagStore from 'sentry/stores/tagStore';
import IssueListSearchBar from 'sentry/views/issueList/searchBar';

describe('IssueListSearchBar', function () {
  let recentSearchMock;
  let defaultProps;

  const {routerContext, organization} = initializeOrg();

  beforeEach(function () {
    TagStore.reset();
    TagStore.loadTagsSuccess(TestStubs.Tags());

    defaultProps = {
      organization,
      query: '',
      onSearch: jest.fn(),
    };

    recentSearchMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/recent-searches/',
      method: 'GET',
      body: [],
    });
  });

  afterEach(function () {
    MockApiClient.clearMockResponses();
  });

  describe('updateAutoCompleteItems()', function () {
    it('sets state with complete tag', function () {
      const tagValuesMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/tags/url/values/',
        method: 'GET',
        body: [],
      });

      render(<IssueListSearchBar {...defaultProps} />, {
        context: routerContext,
      });

      userEvent.type(screen.getByRole('textbox'), 'url:"fu"');

      expect(tagValuesMock).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            query: 'fu',
          }),
        })
      );

      expect(screen.getByTestId('smart-search-dropdown')).toBeInTheDocument();
      expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    });

    it('sets state when value has colon', function () {
      const tagValuesMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/tags/url/values/',
        method: 'GET',
        body: [],
      });

      render(<IssueListSearchBar {...defaultProps} />, {
        context: routerContext,
      });

      userEvent.type(screen.getByRole('textbox'), 'url:');

      expect(tagValuesMock).toHaveBeenCalled();
    });

    it('does not request values when tag is `timesSeen`', function () {
      const tagValuesMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/tags/url/values/',
        method: 'GET',
        body: [],
      });

      render(<IssueListSearchBar {...defaultProps} />, {
        context: routerContext,
      });

      userEvent.type(screen.getByRole('textbox'), 'timesSeen:');

      expect(tagValuesMock).not.toHaveBeenCalled();
    });
  });

  describe('Recent Searches', function () {
    it('saves search query as a recent search', function () {
      const tagValuesMock = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/tags/url/values/',
        method: 'GET',
        body: [],
      });
      const saveRecentSearch = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/recent-searches/',
        method: 'POST',
        body: {},
      });
      const onSearch = jest.fn();

      render(<IssueListSearchBar {...defaultProps} onSearch={onSearch} />, {
        context: routerContext,
      });

      userEvent.type(screen.getByRole('textbox'), 'url:"fu"');

      expect(tagValuesMock).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            query: 'fu',
          }),
        })
      );

      expect(screen.getByTestId('smart-search-dropdown')).toBeInTheDocument();
      expect(screen.queryByRole('listitem')).not.toBeInTheDocument();

      userEvent.keyboard('{Enter}');
      expect(onSearch).toHaveBeenCalledWith('url:"fu"');

      expect(saveRecentSearch).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          data: {
            query: 'url:"fu"',
            type: 0,
          },
        })
      );
    });

    it('queries for recent searches', function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/tags/url/values/',
        method: 'GET',
        body: [],
      });

      render(<IssueListSearchBar {...defaultProps} />, {context: routerContext});

      userEvent.type(screen.getByRole('textbox'), 'is:');

      expect(recentSearchMock).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: {
            query: 'is:',
            limit: 3,
            type: 0,
          },
        })
      );
    });

    it('cycles through keyboard navigation for selection', async function () {
      MockApiClient.addMockResponse({
        url: '/organizations/org-slug/tags/device.orientation/values/',
        method: 'GET',
        body: [],
      });

      render(<IssueListSearchBar {...defaultProps} />, {context: routerContext});

      const textarea = screen.getByRole('textbox');

      // Keyboard navigate to first item and select
      userEvent.type(textarea, 't');
      await waitFor(() =>
        expect(screen.getAllByTestId('search-autocomplete-item')[0]).toBeInTheDocument()
      );
      userEvent.keyboard('{ArrowDown}{Tab}');
      expect(textarea).not.toHaveValue('t');
      const firstItemValue = textarea.textContent;

      // Keyboard navigate to second item and select
      userEvent.keyboard('{selectall}{backspace}t');
      await waitFor(() =>
        expect(screen.getAllByTestId('search-autocomplete-item')[0]).toBeInTheDocument()
      );
      userEvent.keyboard('{ArrowDown}{ArrowDown}{Tab}');
      expect(textarea).not.toHaveValue(firstItemValue);

      // Keyboard navigate to second item, then back to first item and select
      userEvent.keyboard('{selectall}{backspace}t');
      await waitFor(() =>
        expect(screen.getAllByTestId('search-autocomplete-item')[0]).toBeInTheDocument()
      );
      userEvent.keyboard('{ArrowDown}{ArrowDown}{ArrowUp}{Tab}');
      expect(textarea).toHaveValue(firstItemValue);
    });
  });
});
