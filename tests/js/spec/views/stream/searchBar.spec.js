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

  describe("clearSearch()", function() {

    it("clears the query", function() {
      var stubbedOnQueryChange = this.sandbox.spy();
      var wrapper = TestUtils.renderIntoDocument(<SearchBar query={"is:unresolved"} onQueryChange={stubbedOnQueryChange} />);
      wrapper.clearSearch();
      expect(stubbedOnQueryChange.calledWith("")).to.be.true;
    });

    it("calls onSearch()", function(done) {
      var props = {
        query: "is:unresolved",
        onSearch: this.sandbox.spy(),
        onQueryChange: (query, callback) => callback()
      };
      var wrapper = TestUtils.renderIntoDocument(<SearchBar {...props} />);
      wrapper.clearSearch();

      setTimeout(() => {
        expect(props.onSearch.called).to.be.true;
        done();
      });
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

  describe("render()", function() {

    it("invokes onSearch() when submitting the form", function() {
      var stubOnSearch = this.sandbox.spy();
      var wrapper = TestUtils.renderIntoDocument(<SearchBar onSearch={stubOnSearch} />);

      TestUtils.Simulate.submit(wrapper.refs.searchForm, { preventDefault() {} });

      expect(stubOnSearch.called).to.be.true;
    });

    it("invokes onSearch() when search is cleared", function(done) {
      var props = {
        query: "is:unresolved",
        onSearch: this.sandbox.spy(),
        onQueryChange: this.sandbox.spy()
      };
      var wrapper = TestUtils.renderIntoDocument(<SearchBar {...props} />);

      var cancelButton = findWithClass(wrapper, "search-clear-form");
      TestUtils.Simulate.click(cancelButton);

      setTimeout(() => {
        // expect(props.onSearch.called).to.be.true;
        expect(props.onQueryChange.calledWith("", props.onSearch)).to.be.true;
        done();
      });
    });

  });

});
