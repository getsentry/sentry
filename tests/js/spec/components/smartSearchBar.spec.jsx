import React from 'react';
import {shallow, mount} from 'enzyme';

import {SmartSearchBar, addSpace, removeSpace} from 'app/components/smartSearchBar';
import TagStore from 'app/stores/tagStore';

describe('addSpace()', function() {
  it('should add a space when there is no trailing space', function() {
    expect(addSpace('one')).toEqual('one ');
  });

  it('should not add another space when there is already one', function() {
    expect(addSpace('one ')).toEqual('one ');
  });

  it('should leave the empty string alone', function() {
    expect(addSpace('')).toEqual('');
  });
});

describe('removeSpace()', function() {
  it('should remove a trailing space', function() {
    expect(removeSpace('one ')).toEqual('one');
  });

  it('should not remove the last character if it is not a space', function() {
    expect(removeSpace('one')).toEqual('one');
  });

  it('should leave the empty string alone', function() {
    expect(removeSpace('')).toEqual('');
  });
});

describe('SmartSearchBar', function() {
  let options;
  let environmentTagValuesMock;
  let supportedTags;
  const tagValuesMock = jest.fn(() => Promise.resolve([]));

  beforeEach(function() {
    TagStore.reset();
    TagStore.onLoadTagsSuccess(TestStubs.Tags());
    tagValuesMock.mockClear();
    supportedTags = {};

    options = {
      context: {organization: {id: '123'}},
    };

    environmentTagValuesMock = MockApiClient.addMockResponse({
      url: '/projects/123/456/tags/environment/values/',
      body: [],
    });
  });

  afterEach(function() {
    MockApiClient.clearMockResponses();
  });

  describe('componentWillReceiveProps()', function() {
    it('should add a space when setting state.query', function() {
      const searchBar = shallow(
        <SmartSearchBar supportedTags={supportedTags} query="one" />,
        options
      );

      expect(searchBar.state().query).toEqual('one ');
    });

    it('should update state.query if props.query is updated from outside', function() {
      const searchBar = shallow(
        <SmartSearchBar supportedTags={supportedTags} query="one" />,
        options
      );

      searchBar.setProps({query: 'two'});

      expect(searchBar.state().query).toEqual('two ');
    });

    it('should not reset user input if a noop props change happens', function() {
      const searchBar = shallow(
        <SmartSearchBar supportedTags={supportedTags} query="one" />,
        options
      );
      searchBar.setState({query: 'two'});

      searchBar.setProps({query: 'one'});

      expect(searchBar.state().query).toEqual('two');
    });

    it('should reset user input if a meaningful props change happens', function() {
      const searchBar = shallow(
        <SmartSearchBar supportedTags={supportedTags} query="one" />,
        options
      );
      searchBar.setState({query: 'two'});

      searchBar.setProps({query: 'three'});

      expect(searchBar.state().query).toEqual('three ');
    });
  });

  describe('getQueryTerms()', function() {
    it('should extract query terms from a query string', function() {
      let query = 'tagname: ';
      expect(SmartSearchBar.getQueryTerms(query, query.length)).toEqual(['tagname:']);

      query = 'tagname:derp browser:';
      expect(SmartSearchBar.getQueryTerms(query, query.length)).toEqual([
        'tagname:derp',
        'browser:',
      ]);

      query = '   browser:"Chrome 33.0"    ';
      expect(SmartSearchBar.getQueryTerms(query, query.length)).toEqual([
        'browser:"Chrome 33.0"',
      ]);
    });
  });

  describe('getLastTermIndex()', function() {
    it('should provide the index of the last query term, given cursor index', function() {
      let query = 'tagname:';
      expect(SmartSearchBar.getLastTermIndex(query, 0)).toEqual(8);

      query = 'tagname:foo'; // 'f' (index 9)
      expect(SmartSearchBar.getLastTermIndex(query, 9)).toEqual(11);

      query = 'tagname:foo anothertag:bar'; // 'f' (index 9)
      expect(SmartSearchBar.getLastTermIndex(query, 9)).toEqual(11);
    });
  });

  describe('clearSearch()', function() {
    it('clears the query', function() {
      const props = {
        orgId: '123',
        projectId: '456',
        query: 'is:unresolved ruby',
        defaultQuery: 'is:unresolved',
        supportedTags,
      };
      const searchBar = shallow(<SmartSearchBar {...props} />, options).instance();

      searchBar.clearSearch();

      expect(searchBar.state.query).toEqual('');
    });

    it('calls onSearch()', async function() {
      const props = {
        orgId: '123',
        projectId: '456',
        query: 'is:unresolved ruby',
        defaultQuery: 'is:unresolved',
        supportedTags,
        onSearch: jest.fn(),
      };
      const searchBar = shallow(<SmartSearchBar {...props} />, options).instance();

      await searchBar.clearSearch();
      expect(props.onSearch).toHaveBeenCalledWith('');
    });
  });

  describe('onQueryFocus()', function() {
    it('displays the drop down', function() {
      const searchBar = shallow(
        <SmartSearchBar
          orgId="123"
          projectId="456"
          supportedTags={supportedTags}
          onGetTagValues={tagValuesMock}
        />,
        options
      ).instance();
      expect(searchBar.state.dropdownVisible).toBe(false);

      searchBar.onQueryFocus();

      expect(searchBar.state.dropdownVisible).toBe(true);
    });
  });

  describe('onQueryBlur()', function() {
    it('hides the drop down', function() {
      const searchBar = shallow(
        <SmartSearchBar orgId="123" projectId="456" supportedTags={supportedTags} />,
        options
      ).instance();
      searchBar.state.dropdownVisible = true;

      jest.useFakeTimers();
      searchBar.onQueryBlur();
      jest.advanceTimersByTime(201); // doesn't close until 200ms

      expect(searchBar.state.dropdownVisible).toBe(false);
    });
  });

  describe('onKeyUp()', function() {
    describe('escape', function() {
      it('blurs the input', function() {
        const wrapper = shallow(
          <SmartSearchBar orgId="123" projectId="456" supportedTags={supportedTags} />,
          options
        );
        wrapper.setState({dropdownVisible: true});

        const instance = wrapper.instance();
        jest.spyOn(instance, 'blur');

        wrapper.find('input').simulate('keyup', {key: 'Escape', keyCode: '27'});

        expect(instance.blur).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('render()', function() {
    it('invokes onSearch() when submitting the form', function() {
      const stubbedOnSearch = jest.fn();
      const wrapper = mount(
        <SmartSearchBar
          onSearch={stubbedOnSearch}
          orgId="123"
          projectId="456"
          query="is:unresolved"
          supportedTags={supportedTags}
        />,
        options
      );

      wrapper.find('form').simulate('submit', {
        preventDefault() {},
      });

      expect(stubbedOnSearch).toHaveBeenCalledWith('is:unresolved');
    });

    it('invokes onSearch() when search is cleared', async function() {
      jest.useRealTimers();
      const props = {
        orgId: '123',
        projectId: '456',
        query: 'is:unresolved',
        supportedTags,
        onSearch: jest.fn(),
      };
      const wrapper = mount(<SmartSearchBar {...props} />, options);

      wrapper.find('.search-clear-form').simulate('click');

      await tick();
      expect(props.onSearch).toHaveBeenCalledWith('');
    });
  });

  it('handles an empty query', function() {
    const props = {
      orgId: '123',
      projectId: '456',
      query: '',
      defaultQuery: 'is:unresolved',
      supportedTags,
    };
    const wrapper = mount(<SmartSearchBar {...props} />, options);
    expect(wrapper.state('query')).toEqual('');
  });

  describe('updateAutoCompleteItems()', function() {
    beforeEach(function() {
      jest.useFakeTimers();
    });
    it('sets state when empty', function() {
      const props = {
        orgId: '123',
        projectId: '456',
        query: '',
        supportedTags,
      };
      const searchBar = mount(<SmartSearchBar {...props} />, options).instance();
      searchBar.updateAutoCompleteItems();
      expect(searchBar.state.searchTerm).toEqual('');
      expect(searchBar.state.searchItems).toEqual(searchBar.props.defaultSearchItems);
      expect(searchBar.state.activeSearchItem).toEqual(0);
    });

    it('sets state when incomplete tag', async function() {
      const props = {
        orgId: '123',
        projectId: '456',
        query: 'fu',
        supportedTags,
      };
      jest.useRealTimers();
      const wrapper = mount(<SmartSearchBar {...props} />, options);
      const searchBar = wrapper.instance();
      searchBar.updateAutoCompleteItems();
      await tick();
      wrapper.update();
      expect(searchBar.state.searchTerm).toEqual('fu');
      expect(searchBar.state.searchItems).toEqual([]);
      expect(searchBar.state.activeSearchItem).toEqual(0);
    });

    it('sets state when incomplete tag has negation operator', async function() {
      const props = {
        orgId: '123',
        projectId: '456',
        query: '!fu',
        supportedTags,
      };
      jest.useRealTimers();
      const wrapper = mount(<SmartSearchBar {...props} />, options);
      const searchBar = wrapper.instance();
      searchBar.updateAutoCompleteItems();
      await tick();
      wrapper.update();
      expect(searchBar.state.searchTerm).toEqual('fu');
      expect(searchBar.state.searchItems).toEqual([]);
      expect(searchBar.state.activeSearchItem).toEqual(0);
    });

    it('sets state when incomplete tag as second input', async function() {
      const props = {
        orgId: '123',
        projectId: '456',
        query: 'is:unresolved fu',
        supportedTags,
      };
      jest.useRealTimers();
      const wrapper = mount(<SmartSearchBar {...props} />, options);
      const searchBar = wrapper.instance();
      searchBar.getCursorPosition = jest.fn();
      searchBar.getCursorPosition.mockReturnValue(15); // end of line
      searchBar.updateAutoCompleteItems();
      await tick();
      wrapper.update();
      expect(searchBar.state.searchTerm).toEqual('fu');
      expect(searchBar.state.searchItems).toHaveLength(0);
      expect(searchBar.state.activeSearchItem).toEqual(0);
    });

    it('does not request values when tag is environments', function() {
      const props = {
        orgId: '123',
        projectId: '456',
        query: 'environment:production',
        excludeEnvironment: true,
        supportedTags,
      };
      const searchBar = mount(<SmartSearchBar {...props} />, options).instance();
      searchBar.updateAutoCompleteItems();
      jest.advanceTimersByTime(301);
      expect(environmentTagValuesMock).not.toHaveBeenCalled();
    });

    it('does not request values when tag is `timesSeen`', function() {
      // This should never get called
      const mock = MockApiClient.addMockResponse({
        url: '/projects/123/456/tags/timesSeen/values/',
        body: [],
      });
      const props = {
        orgId: '123',
        projectId: '456',
        query: 'timesSeen:',
        supportedTags,
      };
      const searchBar = mount(<SmartSearchBar {...props} />, options).instance();
      searchBar.updateAutoCompleteItems();
      jest.advanceTimersByTime(301);
      expect(mock).not.toHaveBeenCalled();
    });
  });
});
