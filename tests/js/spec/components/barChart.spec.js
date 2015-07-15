var React = require("react/addons");
var Cookies = require("js-cookie");

var BarChart = require("app/components/barChart");
var stubReactComponents = require("../../helpers/stubReactComponent");
var stubRouterContext = require("../../helpers/stubRouterContext");

var TestUtils = React.addons.TestUtils;
var findWithClass = TestUtils.findRenderedDOMComponentWithClass;
var findWithType = TestUtils.findRenderedComponentWithType;

describe("BarChart", function() {

  beforeEach(function() {
    this.sandbox = sinon.sandbox.create();
    this.Element = BarChart;
  });

  afterEach(function() {
    this.sandbox.restore();
    React.unmountComponentAtNode(document.body);
  });

  describe("render()", function() {

    it("renders with default props", function() {
      var comp = React.render(<this.Element />, document.body);
      expect(comp).to.be.ok;
    });

  });

});
