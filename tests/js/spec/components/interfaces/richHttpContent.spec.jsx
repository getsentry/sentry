import React from "react/addons";
var TestUtils = React.addons.TestUtils;
import stubReactComponents from "../../../helpers/stubReactComponent";

import RichHttpContent from "app/components/interfaces/richHttpContent";
import DefinitionList from "app/components/interfaces/definitionList";
import ClippedBox from "app/components/clippedBox";
import ContextData from "app/components/contextData";

describe("RichHttpContent", function () {
  beforeEach(function () {
    this.data = {
      query: '',
      data: '',
      headers: [],
      cookies: [],
      env: {}
    };
    this.sandbox = sinon.sandbox.create();
    stubReactComponents(this.sandbox, [ClippedBox, DefinitionList, ContextData]);
  });

  afterEach(function () {
    this.sandbox.restore();
  });

  describe("objectToTupleArray", function () {
    it("should convert a key/value object to an array of key/value tuples", function () {
      var elem = TestUtils.renderIntoDocument(<RichHttpContent data={this.data} />);
      expect(elem.objectToTupleArray({
        foo: 'bar',
        bar: 'baz'
      })).to.eql([
        ['foo', 'bar'], ['bar', 'baz']
      ]);
    });
  });

  describe("getBodySection", function () {
    it("should return plain-text when unrecognized Content-Type", function () {
      var elem = TestUtils.renderIntoDocument(<RichHttpContent data={this.data} />);

      var data = {
        headers: [], // no content-type header,
        data: 'helloworld'
      };
      var out = elem.getBodySection(data);
      expect(out.type).to.eql('pre');
    });

    it("should return a ContextData element when Content-Type is application/json", function () {
      var elem = TestUtils.renderIntoDocument(<RichHttpContent data={this.data} />);

      var data = {
        headers: [
          ['lol' , 'no'],
          ['Content-Type', 'application/json']
        ], // no content-type header,
        data: JSON.stringify({'foo': 'bar'})
      };

      // NOTE: ContextData is stubbed in tests; instead returns <div className="ContextData"/>
      var out = elem.getBodySection(data);
      expect(out.props.className).to.eql('ContextData');
    });
  });
});
