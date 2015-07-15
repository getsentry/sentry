/*jshint expr: true*/
var React = require("react/addons");

var BarChart = require("app/components/barChart");

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
