var React = require("react/addons");
var api = require("app/api");
var SearchBar = require("app/views/stream/searchBar");
var SearchDropdown = require("app/views/stream/searchDropdown");

var stubReactComponents = require("../../../helpers/stubReactComponent");
var stubRouter = require("../../../helpers/stubRouter");
var stubContext = require("../../../helpers/stubContext");

var TestUtils = React.addons.TestUtils;
var findWithClass = TestUtils.findRenderedDOMComponentWithClass;

describe("SearchBar", function() {

  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();

    this.sandbox.stub(api, "request");

    stubReactComponents(this.sandbox, [SearchDropdown]);
    this.ContextStubbedSearchBar = stubContext(SearchBar, {
      router: stubRouter({
        getCurrentParams() {
          return {
            orgId: "123",
            projectId: "456"
          };
        },
        getCurrentQuery() {
          return { limit: 0 };
        }
      })
    });
  });

  afterEach(function() {
    this.sandbox.restore();

    React.unmountComponentAtNode(document.body);
  });

  describe("getQueryTerms()", function () {
    it ("should extract query terms from a query string", function () {
      let searchBar = React.render(<this.ContextStubbedSearchBar/>, document.body).refs.wrapped;
      let query;

      query = "tagname: ";
      expect(searchBar.getQueryTerms(query, query.length)).to.eql(["tagname:"]);

      query = "tagname:derp browser:";
      expect(searchBar.getQueryTerms(query, query.length)).to.eql(["tagname:derp", "browser:"]);

      query = "   browser:\"Chrome 33.0\"    ";
      expect(searchBar.getQueryTerms(query, query.length)).to.eql(["browser:\"Chrome 33.0\""]);
    });
  });

  describe("clearSearch()", function() {

    it("clears the query", function() {
      var props = {
        query: "is:unresolved ruby",
        defaultQuery: "is:unresolved"
      };
      var wrapper = React.render(<this.ContextStubbedSearchBar {...props} />, document.body).refs.wrapped;

      wrapper.clearSearch();

      expect(wrapper.state.query).to.equal("is:unresolved");
    });

    it("calls onSearch()", function(done) {
      var props = {
        query: "is:unresolved ruby",
        defaultQuery: "is:unresolved",
        onSearch: this.sandbox.spy()
      };
      var wrapper = React.render(<this.ContextStubbedSearchBar {...props} />, document.body).refs.wrapped;

      wrapper.clearSearch();

      setTimeout(() => {
        expect(props.onSearch.calledWith("is:unresolved")).to.be.true;
        done();
      });
    });

  });

  describe("onQueryFocus()", function() {

    it("displays the drop down", function() {
      var wrapper = React.render(<this.ContextStubbedSearchBar />, document.body).refs.wrapped;
      expect(wrapper.state.dropdownVisible).to.be.false;

      wrapper.onQueryFocus();

      expect(wrapper.state.dropdownVisible).to.be.true;
    });

  });

  describe("onQueryBlur()", function() {

    it("hides the drop down", function() {
      var wrapper = React.render(<this.ContextStubbedSearchBar />, document.body).refs.wrapped;
      wrapper.state.dropdownVisible = true;

      var clock = this.sandbox.useFakeTimers();
      wrapper.onQueryBlur();
      clock.tick(201); // doesn't close until 200ms

      expect(wrapper.state.dropdownVisible).to.be.false;
    });

  });

  describe("onKeyUp()", function () {
    describe("escape", function () {
      it("blurs the input", function () {
        var wrapper = React.render(<this.ContextStubbedSearchBar />, document.body).refs.wrapped;
        wrapper.state.dropdownVisible = true;

        var input = React.findDOMNode(wrapper.refs.searchInput);

        input.focus();

        expect(document.activeElement).to.eql(input);

        TestUtils.Simulate.keyUp(input, {key: "Escape", keyCode: "27"});

        expect(document.activeElement).to.not.eql(input);
      });
    });
  });

  describe("render()", function() {

    it("invokes onSearch() when submitting the form", function() {
      var stubbedOnSearch = this.sandbox.spy();
      var wrapper = React.render(<this.ContextStubbedSearchBar onSearch={stubbedOnSearch} />, document.body).refs.wrapped;

      TestUtils.Simulate.submit(wrapper.refs.searchForm, { preventDefault() {} });

      expect(stubbedOnSearch.called).to.be.true;
    });

    it("invokes onSearch() when search is cleared", function(done) {
      var props = {
        query: "is:unresolved",
        onSearch: this.sandbox.spy()
      };
      var wrapper = React.render(<this.ContextStubbedSearchBar {...props} />, document.body).refs.wrapped;

      var cancelButton = findWithClass(wrapper, "search-clear-form");
      TestUtils.Simulate.click(cancelButton);

      setTimeout(() => {
        expect(props.onSearch.calledWith("")).to.be.true;
        done();
      });
    });

  });

});
