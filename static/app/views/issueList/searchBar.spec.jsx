import {mountWithTheme} from 'sentry-test/enzyme';
import {initializeOrg} from 'sentry-test/initializeOrg';

import TagStore from 'sentry/stores/tagStore';
import IssueListSearchBar from 'sentry/views/issueList/searchBar';

import {OrganizationContext} from '../organizationContext';

describe('IssueListSearchBar', function () {
  let tagValuePromise;
  let supportedTags;
  let recentSearchMock;

  const {routerContext, organization} = initializeOrg({
    organization: {access: [], features: []},
  });

  const mockCursorPosition = (wrapper, pos) => {
    const component = wrapper.find('SmartSearchBar').instance();
    delete component.cursorPosition;
    Object.defineProperty(component, 'cursorPosition', {
      get: jest.fn().mockReturnValue(pos),
      configurable: true,
    });
  };

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
    it('sets state with complete tag', async () => {
      const loader = (key, value) => {
        expect(key).toEqual('url');
        expect(value).toEqual('fu');
        return tagValuePromise;
      };
      const props = {
        organization,
        query: 'url:"fu"',
        tagValueLoader: loader,
        supportedTags,
        onSearch: jest.fn(),
      };
      const searchBar = mountWithTheme(
        <OrganizationContext.Provider value={organization}>
          <IssueListSearchBar {...props} />
        </OrganizationContext.Provider>,
        routerContext
      );
      mockCursorPosition(searchBar, 5);

      searchBar.find('textarea').simulate('click');
      searchBar.find('textarea').simulate('focus');

      await tick();

      expect(searchBar.find('SearchDropdown').prop('searchSubstring')).toEqual('"fu"');
      expect(searchBar.find('SearchDropdown').prop('items')).toEqual([]);
    });

    it('sets state when value has colon', async () => {
      const loader = (key, value) => {
        expect(key).toEqual('url');
        expect(value).toEqual('http://example.com');
        return tagValuePromise;
      };

      const props = {
        organization,
        projectId: '456',
        query: 'url:"http://example.com"',
        tagValueLoader: loader,
        supportedTags,
        onSearch: jest.fn(),
      };

      const searchBar = mountWithTheme(
        <OrganizationContext.Provider value={organization}>
          <IssueListSearchBar {...props} />
        </OrganizationContext.Provider>,
        routerContext
      );

      mockCursorPosition(searchBar, 5);

      searchBar.find('textarea').simulate('click');
      searchBar.find('textarea').simulate('focus');

      await tick();

      expect(searchBar.state.searchTerm).toEqual();
      expect(searchBar.find('SearchDropdown').prop('searchSubstring')).toEqual(
        '"http://example.com"'
      );
      expect(searchBar.find('SearchDropdown').prop('items')).toEqual([]);
    });

    it('does not request values when tag is `timesSeen`', async () => {
      // This should never get called
      const loader = jest.fn(x => x);

      const props = {
        organization,
        projectId: '456',
        query: 'timesSeen:',
        tagValueLoader: loader,
        supportedTags,
        onSearch: jest.fn(),
      };
      const searchBar = mountWithTheme(
        <OrganizationContext.Provider value={organization}>
          <IssueListSearchBar {...props} />
        </OrganizationContext.Provider>,
        routerContext
      );

      searchBar.find('textarea').simulate('click');
      searchBar.find('textarea').simulate('focus');

      await tick();

      expect(loader).not.toHaveBeenCalled();
    });
  });

  describe('Recent Searches', function () {
    it('saves search query as a recent search', async function () {
      const saveRecentSearch = MockApiClient.addMockResponse({
        url: '/organizations/org-slug/recent-searches/',
        method: 'POST',
        body: {},
      });
      const loader = (key, value) => {
        expect(key).toEqual('url');
        expect(value).toEqual('fu');
        return tagValuePromise;
      };
      const onSearch = jest.fn();
      const props = {
        organization,
        query: 'url:"fu"',
        onSearch,
        tagValueLoader: loader,
        supportedTags,
      };
      const searchBar = mountWithTheme(
        <OrganizationContext.Provider value={organization}>
          <IssueListSearchBar {...props} />
        </OrganizationContext.Provider>,
        routerContext
      );
      mockCursorPosition(searchBar, 5);
      searchBar.find('textarea').simulate('focus');
      searchBar.find('textarea').simulate('click');

      await tick();

      expect(searchBar.find('SearchDropdown').prop('searchSubstring')).toEqual('"fu"');
      expect(searchBar.find('SearchDropdown').prop('items')).toEqual([]);

      jest.useRealTimers();
      searchBar.find('form').simulate('submit');
      expect(onSearch).toHaveBeenCalledWith('url:"fu"');

      await tick();
      searchBar.update();
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

    it('queries for recent searches', async function () {
      const props = {
        organization,
        query: 'timesSeen:',
        tagValueLoader: () => {},
        savedSearchType: 0,
        displayRecentSearches: true,
        supportedTags,
      };
      jest.useRealTimers();
      const wrapper = mountWithTheme(
        <OrganizationContext.Provider value={organization}>
          <IssueListSearchBar {...props} />
        </OrganizationContext.Provider>,
        routerContext
      );

      wrapper.find('textarea').simulate('focus');
      wrapper.find('textarea').simulate('change', {target: {value: 'is:'}});
      await tick();
      wrapper.update();

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
      const props = {
        organization,
        query: 'timesSeen:',
        tagValueLoader: () => {},
        savedSearchType: 0,
        displayRecentSearches: true,
        supportedTags,
      };
      jest.useRealTimers();
      const wrapper = mountWithTheme(
        <OrganizationContext.Provider value={organization}>
          <IssueListSearchBar {...props} />
        </OrganizationContext.Provider>,
        routerContext
      );

      wrapper
        .find('textarea')
        .simulate('focus')
        .simulate('change', {target: {value: 'is:'}});
      await tick();

      wrapper.update();
      expect(
        wrapper.find('SearchListItem').at(0).find('li').prop('className')
      ).not.toContain('active');

      wrapper.find('textarea').simulate('keyDown', {key: 'ArrowDown'});
      expect(wrapper.find('SearchListItem').at(0).find('li').prop('className')).toContain(
        'active'
      );

      wrapper.find('textarea').simulate('keyDown', {key: 'ArrowDown'});
      expect(wrapper.find('SearchListItem').at(1).find('li').prop('className')).toContain(
        'active'
      );

      wrapper.find('textarea').simulate('keyDown', {key: 'ArrowUp'});
      wrapper.find('textarea').simulate('keyDown', {key: 'ArrowUp'});
      expect(
        wrapper.find('SearchListItem').last().find('li').prop('className')
      ).toContain('active');
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
      const props = {
        query: 'url:"fu"',
        onSearch: jest.fn(),
        tagValueLoader: () => Promise.resolve([]),
        supportedTags,
        organization,
      };
      const searchBar = mountWithTheme(
        <OrganizationContext.Provider value={organization}>
          <IssueListSearchBar {...props} />
        </OrganizationContext.Provider>,
        routerContext
      );

      expect(searchBar.find('ActionButton[data-test-id="pin-icon"]')).toHaveLength(1);
    });

    it('pins a search from the searchbar', function () {
      const props = {
        query: 'url:"fu"',
        onSearch: jest.fn(),
        tagValueLoader: () => Promise.resolve([]),
        supportedTags,
        organization,
      };
      const searchBar = mountWithTheme(
        <OrganizationContext.Provider value={organization}>
          <IssueListSearchBar {...props} />
        </OrganizationContext.Provider>,
        routerContext
      );
      searchBar.find('ActionButton[data-test-id="pin-icon"] button').simulate('click');

      expect(pinSearch).toHaveBeenLastCalledWith(
        expect.anything(),
        expect.objectContaining({
          method: 'PUT',
          data: {
            query: 'url:"fu"',
            type: 0,
          },
        })
      );
    });

    it('unpins a search from the searchbar', function () {
      const props = {
        query: 'url:"fu"',
        onSearch: jest.fn(),
        tagValueLoader: () => Promise.resolve([]),
        supportedTags,
        organization,
        savedSearch: {id: '1', isPinned: true, query: 'url:"fu"'},
      };
      const searchBar = mountWithTheme(
        <OrganizationContext.Provider value={organization}>
          <IssueListSearchBar {...props} />
        </OrganizationContext.Provider>,
        routerContext
      );

      searchBar
        .find('ActionButton[aria-label="Unpin this search"] button')
        .simulate('click');

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
