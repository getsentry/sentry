import React from 'react';

import {mount} from 'sentry-test/enzyme';

import KeyValueList from 'app/components/events/interfaces/keyValueList/keyValueList';

describe('KeyValueList', function () {
  describe('render', function () {
    it('should render a definition list of key/value pairs', function () {
      const data = [
        ['a', 'x'],
        ['b', 'y'],
      ];
      const wrapper = mount(<KeyValueList data={data} />);

      expect(wrapper.find('td.key').at(0).text()).toEqual('a');
      expect(wrapper.find('td.key').at(1).text()).toEqual('b');

      expect(wrapper.find('td.val').at(0).text()).toEqual('x');
      expect(wrapper.find('td.val').at(1).text()).toEqual('y');
    });

    it('should sort sort key/value pairs', function () {
      const data = [
        ['b', 'y'],
        ['a', 'x'],
      ];
      const wrapper = mount(<KeyValueList data={data} />);

      expect(wrapper.find('td.key').at(0).text()).toEqual('a');
      expect(wrapper.find('td.key').at(1).text()).toEqual('b');

      expect(wrapper.find('td.val').at(0).text()).toEqual('x');
      expect(wrapper.find('td.val').at(1).text()).toEqual('y');
    });

    it('should use a single space for values that are an empty string', function () {
      const data = [
        ['b', 'y'],
        ['a', ''], // empty string
      ];
      const wrapper = mount(<KeyValueList data={data} />);

      expect(wrapper.find('td.key').at(0).text()).toEqual('a');
      expect(wrapper.find('td.key').at(1).text()).toEqual('b');

      expect(wrapper.find('td.val').at(0).text()).toEqual(' ');
      expect(wrapper.find('td.val').at(1).text()).toEqual('y');
    });

    it('can sort key/value pairs with non-string values', function () {
      const data = [
        ['b', {foo: 'bar'}],
        ['a', [3, 2, 1]],
      ];
      const wrapper = mount(<KeyValueList isContextData data={data} />);

      // Ignore values, more interested in if keys rendered + are sorted
      expect(wrapper.find('td.key').at(0).text()).toEqual('a');
      expect(wrapper.find('td.key').at(1).text()).toEqual('b');
    });

    it('should coerce non-strings into strings', function () {
      const data = [['a', false]];
      const wrapper = mount(<KeyValueList data={data} />);

      expect(wrapper.find('td.key').at(0).text()).toEqual('a');
      expect(wrapper.find('td.val').at(0).text()).toEqual('false');
    });

    it("shouldn't blow up on null", function () {
      const data = [['a', null]];
      const wrapper = mount(<KeyValueList data={data} />);

      expect(wrapper.find('td.key').at(0).text()).toEqual('a');
      expect(wrapper.find('td.val').at(0).text()).toEqual('null');
    });
  });
});
