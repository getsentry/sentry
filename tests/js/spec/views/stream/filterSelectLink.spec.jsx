/*jshint expr: true*/
var React = require("react/addons");

var FilterSelectLink = require("app/views/stream/filterSelectLink");
var stubReactComponents = require("../../../helpers/stubReactComponent");

var TestUtils = React.addons.TestUtils;
var findWithClass = TestUtils.findRenderedDOMComponentWithClass;
var findWithType = TestUtils.findRenderedComponentWithType;

describe("FilterSelectLink", function() {

  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();
  });

  afterEach(function() {
    this.sandbox.restore();
    React.unmountComponentAtNode(document.body);
  });

  describe("render()", function() {

    it("shows a button", function(){
      var wrapper = React.render(<FilterSelectLink extraClass="test-btn" />, document.body);
      var expected = findWithClass(wrapper, "test-btn");
      expect(expected).to.be.ok;
    });

    it("shows active state when passed isActive=true", function(){
      var wrapper = React.render(<FilterSelectLink isActive={true} />, document.body);
      var expected = findWithClass(wrapper, "active");
      expect(expected).to.be.ok;
    });

    it("doesn't show active state when passed isActive=false", function(){
      var wrapper = React.render(<FilterSelectLink isActive={false} />, document.body);
      expect(() => findWithClass(wrapper, "active")).to.throw();
    });

    it("calls onSelect() when anchor clicked", function(){
      var onSelect = this.sandbox.spy();
      var wrapper = React.render(<FilterSelectLink onSelect={onSelect} />, document.body);

      TestUtils.Simulate.click(wrapper.getDOMNode().firstChild);

      expect(onSelect.called).to.be.true;
    });

  });

});
