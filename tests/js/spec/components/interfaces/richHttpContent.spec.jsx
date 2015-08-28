import React from "react/addons";
var TestUtils = React.addons.TestUtils;
import stubReactComponents from "../../../helpers/stubReactComponent";

import RichHttpContent from "app/components/interfaces/richHttpContent";
import DefinitionList from "app/components/interfaces/definitionList";
import ClippedBox from "app/components/clippedBox";

describe("RichHttpContent", function () {
  beforeEach(function () {
    this.sandbox = sinon.sandbox.create();
    stubReactComponents(this.sandbox, [ClippedBox, DefinitionList]);
  });

  afterEach(function () {
    this.sandbox.restore();
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
