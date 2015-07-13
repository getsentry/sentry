var React = require("react/addons");

var FilterSelectLink = require("app/views/stream/filterSelectLink");
var stubReactComponents = require("../../../helpers/stubReactComponent");

var TestUtils = React.addons.TestUtils;
var findWithClass = TestUtils.findRenderedDOMComponentWithClass;
var findWithType = TestUtils.findRenderedComponentWithType;

describe("FilterSelectLink", function() {

  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();
    this.wrapper = TestUtils.renderIntoDocument(<FilterSelectLink />);
  });

  afterEach(function() {
    this.sandbox.restore();
  });

  describe("render()", function() {

    it("shows a button", function(){
      var expected = findWithClass(this.wrapper, "btn");
      expect(expected).to.be.ok;
    });

    it("shows active state when passed isActive=true", function(){
      this.wrapper = TestUtils.renderIntoDocument(<FilterSelectLink isActive={true} />);
      var expected = findWithClass(this.wrapper, "active");
      expect(expected).to.be.ok;
    });

    it("doesn't show active state when passed isActive=false", function(){
      var wrapper = TestUtils.renderIntoDocument(<FilterSelectLink isActive={false} />);
      function findActive() {
        findWithClass(wrapper, "active");
      }
      expect(findActive).to.throw();
    });


    it("calls onSelect() when clicked", function(){
      var onSelect = this.sandbox.spy();
      this.wrapper = TestUtils.renderIntoDocument(<FilterSelectLink onSelect={onSelect} />);
      TestUtils.Simulate.click(this.wrapper.getDOMNode());

      expect(onSelect.called).to.be.true;
    });

  });

});
