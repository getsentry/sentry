import React from 'react';
import {shallow, mount} from 'enzyme';

import SearchBar from 'app/views/stream/searchBar';
import TagStore from 'app/stores/tagStore';

describe('SearchBar', function() {
  let sandbox;
  let options;
  let urlTagValuesMock;
  let environmentTagValuesMock;

  beforeEach(function() {
    TagStore.reset();
    TagStore.onLoadTagsSuccess(TestStubs.Tags());

    sandbox = sinon.sandbox.create();

    options = {
      context: {organization: {id: '123', features: ['environments']}},
    };

    urlTagValuesMock = MockApiClient.addMockResponse({
      url: '/projects/123/456/tags/url/values/',
      body: [],
    });
    environmentTagValuesMock = MockApiClient.addMockResponse({
      url: '/projects/123/456/tags/environment/values/',
      body: [],
    });
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
    sandbox.restore();
  });

  describe('getQueryTerms()', function() {
    it('should extract query terms from a query string', function() {
      let query = 'tagname: ';
      expect(SearchBar.getQueryTerms(query, query.length)).toEqual(['tagname:']);

      query = 'tagname:derp browser:';
      expect(SearchBar.getQueryTerms(query, query.length)).toEqual([
        'tagname:derp',
        'browser:',
      ]);

      query = '   browser:"Chrome 33.0"    ';
      expect(SearchBar.getQueryTerms(query, query.length)).toEqual([
        'browser:"Chrome 33.0"',
      ]);
    });
  });

  describe('getLastTermIndex()', function() {
    it('should provide the index of the last query term, given cursor index', function() {
      let query = 'tagname:';
      expect(SearchBar.getLastTermIndex(query, 0)).toEqual(8);

      query = 'tagname:foo'; // 'f' (index 9)
      expect(SearchBar.getLastTermIndex(query, 9)).toEqual(11);

      query = 'tagname:foo anothertag:bar'; // 'f' (index 9)
      expect(SearchBar.getLastTermIndex(query, 9)).toEqual(11);
    });
  });

  describe('clearSearch()', function() {
    it('clears the query', function() {
      let props = {
        orgId: '123',
        projectId: '456',
        query: 'is:unresolved ruby',
        defaultQuery: 'is:unresolved',
      };
      let searchBar = shallow(<SearchBar {...props} />, options).instance();

      searchBar.clearSearch();

      expect(searchBar.state.query).toEqual('');
    });

    it('calls onSearch()', function(done) {
      let props = {
        orgId: '123',
        projectId: '456',
        query: 'is:unresolved ruby',
        defaultQuery: 'is:unresolved',
        onSearch: sandbox.spy(),
      };
      let searchBar = shallow(<SearchBar {...props} />, options).instance();

      searchBar.clearSearch();

      setTimeout(() => {
        expect(props.onSearch.calledWith('')).toBe(true);
        done();
      });
    });
  });

  describe('onQueryFocus()', function() {
    it('displays the drop down', function() {
      let searchBar = shallow(
        <SearchBar orgId="123" projectId="456" />,
        options
      ).instance();
      expect(searchBar.state.dropdownVisible).toBe(false);

      searchBar.onQueryFocus();

      expect(searchBar.state.dropdownVisible).toBe(true);
    });
  });

  describe('onQueryBlur()', function() {
    it('hides the drop down', function() {
      let searchBar = shallow(
        <SearchBar orgId="123" projectId="456" />,
        options
      ).instance();
      searchBar.state.dropdownVisible = true;

      let clock = sandbox.useFakeTimers();
      searchBar.onQueryBlur();
      clock.tick(201); // doesn't close until 200ms

      expect(searchBar.state.dropdownVisible).toBe(false);
    });
  });

  describe('onKeyUp()', function() {
    describe('escape', function() {
      it('blurs the input', function() {
        let wrapper = shallow(<SearchBar orgId="123" projectId="456" />, options);
        wrapper.setState({dropdownVisible: true});

        let instance = wrapper.instance();
        sandbox.stub(instance, 'blur');

        wrapper.find('input').simulate('keyup', {key: 'Escape', keyCode: '27'});

        expect(instance.blur.calledOnce).toBeTruthy();
      });
    });
  });

  describe('render()', function() {
    it('invokes onSearch() when submitting the form', function() {
      let stubbedOnSearch = sandbox.spy();
      let wrapper = mount(
        <SearchBar onSearch={stubbedOnSearch} orgId="123" projectId="456" />,
        options
      );

      wrapper.find('form').simulate('submit', {
        preventDefault() {},
      });

      expect(stubbedOnSearch.called).toBe(true);
    });

    it('invokes onSearch() when search is cleared', function(done) {
      let props = {
        orgId: '123',
        projectId: '456',
        query: 'is:unresolved',
        onSearch: sandbox.spy(),
      };
      let wrapper = mount(<SearchBar {...props} />, options);

      wrapper.find('.search-clear-form').simulate('click');

      setTimeout(function() {
        expect(props.onSearch.calledWith('')).toBe(true);
        done();
      });
    });
  });

  it('handles an empty query', function() {
    let props = {
      orgId: '123',
      projectId: '456',
      query: '',
      defaultQuery: 'is:unresolved',
    };
    let wrapper = mount(<SearchBar {...props} />, options);
    expect(wrapper.state('query')).toEqual('');
  });

  describe('updateAutoCompleteItems()', function() {
    let clock;

    beforeEach(function() {
      clock = sandbox.useFakeTimers();
    });
    afterEach(function() {
      clock.restore();
    });
    it('sets state when empty', function() {
      let props = {
        orgId: '123',
        projectId: '456',
        query: '',
      };
      let searchBar = mount(<SearchBar {...props} />, options).instance();
      searchBar.updateAutoCompleteItems();
      expect(searchBar.state.searchTerm).toEqual('');
      expect(searchBar.state.searchItems).toEqual(searchBar.props.defaultSearchItems);
      expect(searchBar.state.activeSearchItem).toEqual(0);
    });

    it('sets state when incomplete tag', function() {
      let props = {
        orgId: '123',
        projectId: '456',
        query: 'fu',
      };
      let searchBar = mount(<SearchBar {...props} />, options).instance();
      searchBar.updateAutoCompleteItems();
      expect(searchBar.state.searchTerm).toEqual('fu');
      expect(searchBar.state.searchItems).toEqual([]);
      expect(searchBar.state.activeSearchItem).toEqual(0);
    });

    it('sets state with complete tag', function() {
      let props = {
        orgId: '123',
        projectId: '456',
        query: 'url:"fu"',
      };
      let searchBar = mount(<SearchBar {...props} />, options).instance();
      searchBar.updateAutoCompleteItems();
      clock.tick(301);
      expect(searchBar.state.searchTerm).toEqual('"fu"');
      expect(searchBar.state.searchItems).toEqual([]);
      expect(searchBar.state.activeSearchItem).toEqual(0);
    });

    it('sets state when incomplete tag as second input', function() {
      let props = {
        orgId: '123',
        projectId: '456',
        query: 'is:unresolved fu',
      };
      let searchBar = mount(<SearchBar {...props} />, options).instance();
      searchBar.getCursorPosition = jest.fn();
      searchBar.getCursorPosition.mockReturnValue(15); // end of line
      searchBar.updateAutoCompleteItems();
      expect(searchBar.state.searchTerm).toEqual('fu');
      expect(searchBar.state.searchItems).toHaveLength(0);
      expect(searchBar.state.activeSearchItem).toEqual(0);
    });

    it('sets state when value has colon', function() {
      let props = {
        orgId: '123',
        projectId: '456',
        query: 'url:"http://example.com"',
      };

      let searchBar = mount(<SearchBar {...props} />, options).instance();
      searchBar.updateAutoCompleteItems();
      expect(searchBar.state.searchTerm).toEqual('"http://example.com"');
      expect(searchBar.state.searchItems).toEqual([]);
      expect(searchBar.state.activeSearchItem).toEqual(0);
      clock.tick(301);
      expect(urlTagValuesMock).toHaveBeenCalled();
    });

    it('does not request values when tag is environments', function() {
      let props = {
        orgId: '123',
        projectId: '456',
        query: 'environment:production',
        excludeEnvironment: true,
      };
      let searchBar = mount(<SearchBar {...props} />, options).instance();
      searchBar.updateAutoCompleteItems();
      clock.tick(301);
      expect(environmentTagValuesMock).not.toHaveBeenCalled();
    });
  });
});
