import React from "react/addons";
var TestUtils = React.addons.TestUtils;
import stubReactComponents from "../../../helpers/stubReactComponent";

import {RichHttpContent, DefinitionList} from "app/components/interfaces/request";
import ClippedBox from "app/components/clippedBox";

describe("request", function() {
  beforeEach(function () {
    this.sandbox = sinon.sandbox.create();
  });

  afterEach(function () {
    this.sandbox.restore();
  });

  describe("RichHttpContent", function () {
    beforeEach(function () {
      stubReactComponents(this.sandbox, [ClippedBox, DefinitionList]);
    });

    describe("objectToTupleArray", function () {
      it("should convert a key/value object to an array of key/value tuples", function () {
        var data = {
          query: '',
          data: '',
          headers: [],
          cookies: [],
          env: {}
        };

        var elem = TestUtils.renderIntoDocument(<RichHttpContent data={data} />);
        expect(elem.objectToTupleArray({
          foo: 'bar',
          bar: 'baz'
        })).to.eql([
          ['foo', 'bar'], ['bar', 'baz']
        ]);
      });
    });
  });

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
});
