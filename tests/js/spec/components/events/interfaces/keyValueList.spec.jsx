import React from 'react';
import {mount, shallow} from 'enzyme';

import KeyValueList from 'app/components/events/interfaces/keyValueList';

describe('KeyValueList', function() {
  describe('render', function() {
    it('should render a definition list of key/value pairs', function() {
      let data = [['a', 'x'], ['b', 'y']];
      let wrapper = shallow(<KeyValueList data={data} />);

      expect(
        wrapper
          .find('.key')
          .at(0)
          .text()
      ).toEqual('a');
      expect(
        wrapper
          .find('.key')
          .at(1)
          .text()
      ).toEqual('b');

      expect(
        wrapper
          .find('.value')
          .at(0)
          .text()
      ).toEqual('x');
      expect(
        wrapper
          .find('.value')
          .at(1)
          .text()
      ).toEqual('y');
    });

    it('should sort sort key/value pairs', function() {
      let data = [['b', 'y'], ['a', 'x']];
      let wrapper = shallow(<KeyValueList data={data} />);

      expect(
        wrapper
          .find('.key')
          .at(0)
          .text()
      ).toEqual('a');
      expect(
        wrapper
          .find('.key')
          .at(1)
          .text()
      ).toEqual('b');

      expect(
        wrapper
          .find('.value')
          .at(0)
          .text()
      ).toEqual('x');
      expect(
        wrapper
          .find('.value')
          .at(1)
          .text()
      ).toEqual('y');
    });

    it('should use a single space for values that are an empty string', function() {
      let data = [
        ['b', 'y'],
        ['a', ''], // empty string
      ];
      let wrapper = shallow(<KeyValueList data={data} />);

      expect(
        wrapper
          .find('.key')
          .at(0)
          .text()
      ).toEqual('a');
      expect(
        wrapper
          .find('.key')
          .at(1)
          .text()
      ).toEqual('b');

      expect(
        wrapper
          .find('.value')
          .at(0)
          .text()
      ).toEqual(' ');
      expect(
        wrapper
          .find('.value')
          .at(1)
          .text()
      ).toEqual('y');
    });

    it('can sort key/value pairs with non-string values', function() {
      let data = [['b', {foo: 'bar'}], ['a', [3, 2, 1]]];
      let wrapper = mount(<KeyValueList isContextData data={data} />);

      // Ignore values, more interested in if keys rendered + are sorted
      expect(
        wrapper
          .find('.key')
          .at(0)
          .text()
      ).toEqual('a');
      expect(
        wrapper
          .find('.key')
          .at(1)
          .text()
      ).toEqual('b');
    });

    it('should coerce non-strings into strings', function() {
      let data = [['a', false]];
      let wrapper = shallow(<KeyValueList data={data} />);

      expect(
        wrapper
          .find('.key')
          .at(0)
          .text()
      ).toEqual('a');
      expect(
        wrapper
          .find('.value')
          .at(0)
          .text()
      ).toEqual('false');
    });

    it("shouldn't blow up on null", function() {
      let data = [['a', null]];
      let wrapper = shallow(<KeyValueList data={data} />);

      expect(
        wrapper
          .find('.key')
          .at(0)
          .text()
      ).toEqual('a');
      expect(
        wrapper
          .find('.value')
          .at(0)
          .text()
      ).toEqual('null');
    });
  });
});
