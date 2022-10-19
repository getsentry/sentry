import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import TagStore from 'sentry/stores/tagStore';
import IssueListSearchBar from 'sentry/views/issueList/searchBar';

import {OrganizationContext} from '../organizationContext';

describe('IssueListSearchBar', function () {
  let tagValuePromise;
  let supportedTags;
  let recentSearchMock;
  let defaultProps;

  const {routerContext, organization} = initializeOrg();

  beforeEach(function () {
    TagStore.reset();
    TagStore.loadTagsSuccess(TestStubs.Tags());
    supportedTags = TagStore.getState();
    // Add a tag that is preseeded with values.
    supportedTags.is = {
      key: 'is',
      name: 'is',
      values: ['assigned', 'unresolved', 'ignored'],
      predefined: true,
    };

    tagValuePromise = Promise.resolve([]);
    defaultProps = {
      organization,
      query: '',
      tagValueLoader: () => tagValuePromise,
      supportedTags,
      onSearch: jest.fn(),
      onSidebarToggle: () => {},
      sort: 'date',
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
      const loader = jest.fn();

      render(
        <OrganizationContext.Provider value={organization}>
          <IssueListSearchBar {...defaultProps} tagValueLoader={loader} />
        </OrganizationContext.Provider>,
        {context: routerContext}
      );

      userEvent.type(screen.getByRole('textbox'), 'url:"fu"');

      expect(loader).toHaveBeenCalledWith('url', 'fu');

      expect(screen.getByTestId('smart-search-dropdown')).toBeInTheDocument();
      expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    });

    it('sets state when value has colon', function () {
      const loader = jest.fn();

      render(
        <OrganizationContext.Provider value={organization}>
          <IssueListSearchBar {...defaultProps} tagValueLoader={loader} />
        </OrganizationContext.Provider>,
        {context: routerContext}
      );

      userEvent.type(screen.getByRole('textbox'), 'url:');

      expect(loader).toHaveBeenCalledWith('url', '');
    });

    it('does not request values when tag is `timesSeen`', function () {
      // This should never get called
      const loader = jest.fn(x => x);

      render(
        <OrganizationContext.Provider value={organization}>
          <IssueListSearchBar {...defaultProps} tagValueLoader={loader} />
        </OrganizationContext.Provider>,
        {context: routerContext}
      );

      userEvent.type(screen.getByRole('textbox'), 'timesSeen:');

      expect(loader).not.toHaveBeenCalled();
    });
  });

  describe('Recent Searches', function () {
    it('saves search query as a recent search', function () {
      const saveRecentSearch = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/recent-searches/',
        method: 'POST',
        body: {},
      });
      const loader = jest.fn();
      const onSearch = jest.fn();

      render(
        <OrganizationContext.Provider value={organization}>
          <IssueListSearchBar
            {...defaultProps}
            tagValueLoader={loader}
            onSearch={onSearch}
          />
        </OrganizationContext.Provider>,
        {context: routerContext}
      );

      userEvent.type(screen.getByRole('textbox'), 'url:"fu"');

      expect(loader).toHaveBeenCalledWith('url', 'fu');

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
      render(
        <OrganizationContext.Provider value={organization}>
          <IssueListSearchBar {...defaultProps} />
        </OrganizationContext.Provider>,
        {context: routerContext}
      );

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
      render(
        <OrganizationContext.Provider value={organization}>
          <IssueListSearchBar {...defaultProps} />
        </OrganizationContext.Provider>,
        {context: routerContext}
      );

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
      render(
        <OrganizationContext.Provider value={organization}>
          <IssueListSearchBar {...defaultProps} />
        </OrganizationContext.Provider>,
        {context: routerContext}
      );

      expect(screen.getByTestId('pin-icon')).toBeInTheDocument();
    });

    it('pins a search from the searchbar', function () {
      render(
        <OrganizationContext.Provider value={organization}>
          <IssueListSearchBar {...defaultProps} query='url:"fu"' />
        </OrganizationContext.Provider>,
        {context: routerContext}
      );

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
        <OrganizationContext.Provider value={organization}>
          <IssueListSearchBar
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
          />
        </OrganizationContext.Provider>,
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
