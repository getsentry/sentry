import React from "react/addons";
var TestUtils = React.addons.TestUtils;
import DefinitionList from "app/components/interfaces/definitionList";

describe('DefinitionList', function () {
  describe("render", function () {
    it("should render a definition list of key/value pairs", function () {
      var data = [
        ['a', 'x'], ['b', 'y']
      ];
      var elem = TestUtils.renderIntoDocument(<DefinitionList data={data} />);

      var dts = TestUtils.scryRenderedDOMComponentsWithTag(elem, 'dt');
      expect(dts[0].getDOMNode().textContent).to.eql('a');
      expect(dts[1].getDOMNode().textContent).to.eql('b');

      var dds = TestUtils.scryRenderedDOMComponentsWithTag(elem, 'dd');
      expect(dds[0].getDOMNode().textContent).to.eql('x');
      expect(dds[1].getDOMNode().textContent).to.eql('y');
    });
  });
});
