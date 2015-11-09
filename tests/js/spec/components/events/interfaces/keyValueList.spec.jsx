import React from 'react';
import ReactDOM from 'react-dom';
import TestUtils from 'react-addons-test-utils';

import KeyValueList from 'app/components/events/interfaces/keyValueList';

describe('KeyValueList', function () {
  describe('render', function () {
    it('should render a definition list of key/value pairs', function () {
      let data = [
        ['a', 'x'], ['b', 'y']
      ];
      let elem = TestUtils.renderIntoDocument(<KeyValueList data={data} />);

      let dts = TestUtils.scryRenderedDOMComponentsWithTag(elem, 'dt');
      expect(ReactDOM.findDOMNode(dts[0]).textContent).to.eql('a');
      expect(ReactDOM.findDOMNode(dts[1]).textContent).to.eql('b');

      let dds = TestUtils.scryRenderedDOMComponentsWithTag(elem, 'dd');
      expect(ReactDOM.findDOMNode(dds[0]).textContent).to.eql('x');
      expect(ReactDOM.findDOMNode(dds[1]).textContent).to.eql('y');
    });

    it('should sort sort key/value pairs', function () {
      let data = [
        ['b', 'y'], ['a', 'x']
      ];
      let elem = TestUtils.renderIntoDocument(<KeyValueList data={data} />);

      let dts = TestUtils.scryRenderedDOMComponentsWithTag(elem, 'dt');
      expect(ReactDOM.findDOMNode(dts[0]).textContent).to.eql('a');
      expect(ReactDOM.findDOMNode(dts[1]).textContent).to.eql('b');

      let dds = TestUtils.scryRenderedDOMComponentsWithTag(elem, 'dd');
      expect(ReactDOM.findDOMNode(dds[0]).textContent).to.eql('x');
      expect(ReactDOM.findDOMNode(dds[1]).textContent).to.eql('y');
    });

    it('should use a single space for values that are an empty string', function () {
      let data = [
        ['b', 'y'], ['a', ''] // empty string
      ];
      let elem = TestUtils.renderIntoDocument(<KeyValueList data={data} />);

      let dts = TestUtils.scryRenderedDOMComponentsWithTag(elem, 'dt');
      expect(ReactDOM.findDOMNode(dts[0]).textContent).to.eql('a');
      expect(ReactDOM.findDOMNode(dts[1]).textContent).to.eql('b');

      let dds = TestUtils.scryRenderedDOMComponentsWithTag(elem, 'dd');
      expect(ReactDOM.findDOMNode(dds[0]).textContent).to.eql(' ');
      expect(ReactDOM.findDOMNode(dds[1]).textContent).to.eql('y');
    });

    it('should coerce non-strings into strings', function () {
      let data = [
        ['a', false]
      ];
      let elem = TestUtils.renderIntoDocument(<KeyValueList data={data} />);

      let dts = TestUtils.scryRenderedDOMComponentsWithTag(elem, 'dt');
      expect(ReactDOM.findDOMNode(dts[0]).textContent).to.eql('a');

      let dds = TestUtils.scryRenderedDOMComponentsWithTag(elem, 'dd');
      expect(ReactDOM.findDOMNode(dds[0]).textContent).to.eql('false');
    });

    it('shouldn\'t blow up on null', function () {
      let data = [
        ['a', null]
      ];
      let elem = TestUtils.renderIntoDocument(<KeyValueList data={data} />);

      let dts = TestUtils.scryRenderedDOMComponentsWithTag(elem, 'dt');
      expect(ReactDOM.findDOMNode(dts[0]).textContent).to.eql('a');

      let dds = TestUtils.scryRenderedDOMComponentsWithTag(elem, 'dd');
      expect(ReactDOM.findDOMNode(dds[0]).textContent).to.eql('null');
    });
  });
});
