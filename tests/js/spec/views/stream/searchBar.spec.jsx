/*jshint expr: true*/
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
    React.unmountComponentAtNode(document.body);
  });

  describe("clearSearch()", function() {

    it("clears the query", function() {
      var props = {
        query: "is:unresolved",
        onQueryChange: this.sandbox.spy()
      };
      var wrapper = React.render(<SearchBar {...props} />, document.body);

      wrapper.clearSearch();

      expect(props.onQueryChange.calledWith("")).to.be.true;
    });

    it("calls onSearch()", function(done) {
      var props = {
        query: "is:unresolved",
        onSearch: this.sandbox.spy(),
        onQueryChange: this.sandbox.spy()
      };
      var wrapper = React.render(<SearchBar {...props} />, document.body);

      wrapper.clearSearch();

      setTimeout(() => {
        expect(props.onQueryChange.calledWith("", props.onSearch)).to.be.true;
        done();
      });
    });

  });

  describe("onQueryFocus()", function() {

    it("displays the drop down", function() {
      var wrapper = React.render(<SearchBar />, document.body);
      expect(wrapper.state.dropdownVisible).to.be.false;

      wrapper.onQueryFocus();

      expect(wrapper.state.dropdownVisible).to.be.true;
    });

  });

  describe("onQueryBlur()", function() {

    it("hides the drop down", function() {
      var wrapper = React.render(<SearchBar />, document.body);
      wrapper.state.dropdownVisible = true;

      wrapper.onQueryBlur();

      expect(wrapper.state.dropdownVisible).to.be.false;
    });

  });

  describe("onKeyUp()", function () {
    describe("escape", function () {
      it("blurs the input", function () {
        var wrapper = React.render(<SearchBar />, document.body);
        wrapper.state.dropdownVisible = true;

        var input = React.findDOMNode(wrapper.refs.searchInput);

        input.focus();

        expect(document.activeElement).to.eql(input);

        TestUtils.Simulate.keyUp(input, {key: "Escape", keyCode: "27"}});

        expect(document.activeElement).to.not.eql(input);
      });
    });
  });

  describe("render()", function() {

    it("invokes onSearch() when submitting the form", function() {
      var stubbedOnSearch = this.sandbox.spy();
      var wrapper = React.render(<SearchBar onSearch={stubbedOnSearch} />, document.body);

      TestUtils.Simulate.submit(wrapper.refs.searchForm, { preventDefault() {} });

      expect(stubbedOnSearch.called).to.be.true;
    });

    it("invokes onSearch() when search is cleared", function(done) {
      var props = {
        query: "is:unresolved",
        onSearch: this.sandbox.spy(),
        onQueryChange: this.sandbox.spy()
      };
      var wrapper = React.render(<SearchBar {...props} />, document.body);

      var cancelButton = findWithClass(wrapper, "search-clear-form");
      TestUtils.Simulate.click(cancelButton);

      setTimeout(() => {
        expect(props.onQueryChange.calledWith("", props.onSearch)).to.be.true;
        done();
      });
    });

  });

});
