var React = require("react/addons");

var SearchBar = require("app/views/stream/searchBar");
var SearchDropdown = require("app/views/stream/searchDropdown");
var stubReactComponents = require("../../../helpers/stubReactComponent");

var TestUtils = React.addons.TestUtils;
var findWithClass = TestUtils.findRenderedDOMComponentWithClass;
var findWithType = TestUtils.findRenderedComponentWithType;

describe("SearchBar", function() {

  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();
    stubReactComponents(this.sandbox, [SearchDropdown]);
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  describe("getInitialState()", function() {

    it("inherits the query state from props", function() {
      var wrapper = TestUtils.renderIntoDocument(<SearchBar defaultQuery={"is:unresolved"} />);
      var expected = wrapper.state.query; expect(expected).to.be.eql("is:unresolved");
    });

  });

  describe("clearSearch()", function() {

    it("clears the query", function() {
      var wrapper = TestUtils.renderIntoDocument(<SearchBar defaultQuery={"is:unresolved"} />);
      wrapper.clearSearch();
      expect(wrapper.state.query).to.eql("");
    });

    it("calls onSearch()", function() {
      var stubbedOnSearch = this.sandbox.spy();
      var wrapper = TestUtils.renderIntoDocument(<SearchBar defaultQuery={"is:unresolved"} onSearch={stubbedOnSearch}/>);
      wrapper.clearSearch();
      expect(stubbedOnSearch.calledWith("")).to.be.true;
    });

  });

  describe("onQueryFocus()", function() {

    it("displays the drop down", function() {
      var wrapper = TestUtils.renderIntoDocument(<SearchBar />);
      expect(wrapper.state.dropdownVisible).to.be.false;
      wrapper.onQueryFocus();
      expect(wrapper.state.dropdownVisible).to.be.true;
    });
  });

  describe("onQueryBlur()", function() {

    it("hides the drop down", function() {
      var wrapper = TestUtils.renderIntoDocument(<SearchBar />);
      wrapper.state.dropdownVisible = true;

      wrapper.onQueryBlur();
      expect(wrapper.state.dropdownVisible).to.be.false;
    });

  });

  describe("onQueryChange()", function() {

    it("sets the query", function() {
      var wrapper = TestUtils.renderIntoDocument(<SearchBar />);
      wrapper.state.query = "is:resolved";

      wrapper.onQueryChange({ target: { value: "java" } });
      expect(wrapper.state.query).to.eql("java");
    });

  });

  describe("render()", function() {

    it("invokes onSearch() when search input changes", function() {
      var stubOnSearch = this.sandbox.spy();
      var wrapper = TestUtils.renderIntoDocument(<SearchBar onSearch={stubOnSearch} />);

      TestUtils.Simulate.change(wrapper.refs.searchInput, { target: { value: "java" } });
      TestUtils.Simulate.submit(wrapper.refs.searchForm, { preventDefault() {} });

      expect(stubOnSearch.calledWith("java")).to.be.true;
    });

    it("invokes onSearch() when search is cleared", function() {
      var stubOnSearch = this.sandbox.spy();
      var wrapper = TestUtils.renderIntoDocument(<SearchBar onSearch={stubOnSearch} />);
      wrapper.setState({
        query: "this-is-not-empty"
      });

      var cancelButton = findWithClass(wrapper, "search-clear-form");
      TestUtils.Simulate.click(cancelButton);

      expect(stubOnSearch.calledWith("")).to.be.true;
    });

  });

});
