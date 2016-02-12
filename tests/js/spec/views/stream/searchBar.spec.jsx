import React from 'react';
import ReactDOM from 'react-dom';
import TestUtils from 'react-addons-test-utils';
import {Client} from 'app/api';
import SearchBar from 'app/views/stream/searchBar';
import SearchDropdown from 'app/views/stream/searchDropdown';
import StreamTagStore from 'app/stores/streamTagStore';
import stubReactComponents from '../../../helpers/stubReactComponent';

import stubContext from '../../../helpers/stubContext';

let findWithClass = TestUtils.findRenderedDOMComponentWithClass;

describe('SearchBar', function() {

  beforeEach(function() {
    StreamTagStore.reset();

    this.sandbox = sinon.sandbox.create();

    this.sandbox.stub(Client.prototype, 'request');

    stubReactComponents(this.sandbox, [SearchDropdown]);
    this.ContextStubbedSearchBar = stubContext(SearchBar);
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  describe('getQueryTerms()', function () {
    it ('should extract query terms from a query string', function () {
      let query = 'tagname: ';
      expect(SearchBar.getQueryTerms(query, query.length)).to.eql(['tagname:']);

      query = 'tagname:derp browser:';
      expect(SearchBar.getQueryTerms(query, query.length)).to.eql(['tagname:derp', 'browser:']);

      query = '   browser:"Chrome 33.0"    ';
      expect(SearchBar.getQueryTerms(query, query.length)).to.eql(['browser:"Chrome 33.0"']);
    });
  });

  describe('getLastTermIndex()', function () {
    it('should provide the index of the last query term, given cursor index', function () {
      let query = 'tagname:';
      expect(SearchBar.getLastTermIndex(query, 0)).to.eql(8);

      query = 'tagname:foo'; // 'f' (index 9)
      expect(SearchBar.getLastTermIndex(query, 9)).to.eql(11);

      query = 'tagname:foo anothertag:bar'; // 'f' (index 9)
      expect(SearchBar.getLastTermIndex(query, 9)).to.eql(11);
    });
  });

  describe('clearSearch()', function() {

    it('clears the query', function() {
      let props = {
        orgId: '123',
        projectId: '456',
        query: 'is:unresolved ruby',
        defaultQuery: 'is:unresolved'
      };
      let wrapper = TestUtils.renderIntoDocument(<this.ContextStubbedSearchBar {...props} />).refs.wrapped;

      wrapper.clearSearch();

      expect(wrapper.state.query).to.equal('');
    });

    it('calls onSearch()', function(done) {
      let props = {
        orgId: '123',
        projectId: '456',
        query: 'is:unresolved ruby',
        defaultQuery: 'is:unresolved',
        onSearch: this.sandbox.spy()
      };
      let wrapper = TestUtils.renderIntoDocument(<this.ContextStubbedSearchBar {...props} />).refs.wrapped;

      wrapper.clearSearch();

      setTimeout(() => {
        expect(props.onSearch.calledWith('')).to.be.true;
        done();
      });
    });

  });

  describe('onQueryFocus()', function() {

    it('displays the drop down', function() {
      let wrapper = TestUtils.renderIntoDocument(<this.ContextStubbedSearchBar orgId="123" projectId="456"/>).refs.wrapped;
      expect(wrapper.state.dropdownVisible).to.be.false;

      wrapper.onQueryFocus();

      expect(wrapper.state.dropdownVisible).to.be.true;
    });

  });

  describe('onQueryBlur()', function() {

    it('hides the drop down', function() {
      let wrapper = TestUtils.renderIntoDocument(<this.ContextStubbedSearchBar orgId="123" projectId="456"/>).refs.wrapped;
      wrapper.state.dropdownVisible = true;

      let clock = this.sandbox.useFakeTimers();
      wrapper.onQueryBlur();
      clock.tick(201); // doesn't close until 200ms

      expect(wrapper.state.dropdownVisible).to.be.false;
    });

  });

  describe('onKeyUp()', function () {
    describe('escape', function () {
      it('blurs the input', function () {
        // needs to be rendered into document.body or cannot query document.activeElement
        let wrapper = ReactDOM.render(<this.ContextStubbedSearchBar orgId="123" projectId="456"/>, document.body).refs.wrapped;
        wrapper.state.dropdownVisible = true;

        let input = ReactDOM.findDOMNode(wrapper.refs.searchInput);

        input.focus();

        expect(document.activeElement).to.eql(input);

        TestUtils.Simulate.keyUp(input, {key: 'Escape', keyCode: '27'});

        expect(document.activeElement).to.not.eql(input);
      });
    });
  });

  describe('render()', function() {

    it('invokes onSearch() when submitting the form', function() {
      let stubbedOnSearch = this.sandbox.spy();
      let wrapper = TestUtils.renderIntoDocument(<this.ContextStubbedSearchBar onSearch={stubbedOnSearch} orgId="123" projectId="456"/>).refs.wrapped;

      TestUtils.Simulate.submit(wrapper.refs.searchForm, {preventDefault() {}});

      expect(stubbedOnSearch.called).to.be.true;
    });

    it('invokes onSearch() when search is cleared', function(done) {
      let props = {
        orgId: '123',
        projectId: '456',
        query: 'is:unresolved',
        onSearch: this.sandbox.spy()
      };
      let wrapper = TestUtils.renderIntoDocument(<this.ContextStubbedSearchBar {...props} />).refs.wrapped;

      let cancelButton = findWithClass(wrapper, 'search-clear-form');
      TestUtils.Simulate.click(cancelButton);

      setTimeout(function () {
        expect(props.onSearch.calledWith('')).to.be.true;
        done();
      });
    });

    it('handles an empty query', function () {
      let props = {
        orgId: '123',
        projectId: '456',
        query: '',
        defaultQuery: 'is:unresolved'
      };
      let wrapper = TestUtils.renderIntoDocument(<this.ContextStubbedSearchBar {...props} />).refs.wrapped;
      expect(wrapper.state.query).to.eql('');
    });

  });

  describe('updateAutoCompleteItems()', function() {
    it('sets state when empty', function() {
      let props = {
        orgId: '123',
        projectId: '456',
        query: '',
      };
      let wrapper = TestUtils.renderIntoDocument(<this.ContextStubbedSearchBar {...props} />).refs.wrapped;
      wrapper.updateAutoCompleteItems();
      expect(wrapper.state.searchTerm).to.eql('');
      expect(wrapper.state.searchItems).to.eql(wrapper.props.defaultSearchItems);
      expect(wrapper.state.activeSearchItem).to.eql(0);
    });

    it('sets state when incomplete tag', function() {
      let props = {
        orgId: '123',
        projectId: '456',
        query: 'fu',
      };
      let wrapper = TestUtils.renderIntoDocument(<this.ContextStubbedSearchBar {...props} />).refs.wrapped;
      wrapper.updateAutoCompleteItems();
      expect(wrapper.state.searchTerm).to.eql('fu');
      expect(wrapper.state.searchItems).to.eql([]);
      expect(wrapper.state.activeSearchItem).to.eql(0);
    });

    it('sets state with complete tag', function() {
      let props = {
        orgId: '123',
        projectId: '456',
        query: 'url:"fu"',
      };
      let wrapper = TestUtils.renderIntoDocument(<this.ContextStubbedSearchBar {...props} />).refs.wrapped;
      wrapper.updateAutoCompleteItems();
      expect(wrapper.state.searchTerm).to.eql('"fu"');
      expect(wrapper.state.searchItems).to.eql([]);
      expect(wrapper.state.activeSearchItem).to.eql(0);
    });

    it('sets state when incomplete tag as second input', function() {
      let props = {
        orgId: '123',
        projectId: '456',
        query: 'is:unresolved fu',
      };
      let wrapper = TestUtils.renderIntoDocument(<this.ContextStubbedSearchBar {...props} />).refs.wrapped;
      wrapper.updateAutoCompleteItems();
      expect(wrapper.state.searchTerm).to.eql('unresolved');
      expect(wrapper.state.searchItems.length).to.eql(1);
      expect(wrapper.state.searchItems[0].desc).to.eql('unresolved');
      expect(wrapper.state.searchItems[0].value).to.eql('unresolved');
      expect(wrapper.state.activeSearchItem).to.eql(0);
    });

    it('sets state when value has colon', function() {
      let props = {
        orgId: '123',
        projectId: '456',
        query: 'url:"http://example.com"',
      };
      let wrapper = TestUtils.renderIntoDocument(<this.ContextStubbedSearchBar {...props} />).refs.wrapped;
      wrapper.updateAutoCompleteItems();
      expect(wrapper.state.searchTerm).to.eql('"http://example.com"');
      expect(wrapper.state.searchItems).to.eql([]);
      expect(wrapper.state.activeSearchItem).to.eql(0);
    });
  });

});

