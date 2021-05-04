import {mountWithTheme} from 'sentry-test/enzyme';

import KeyValueList from 'app/components/events/interfaces/keyValueList';

describe('KeyValueList', function () {
  describe('render', function () {
    it('should render a definition list of key/value pairs', function () {
      const data = [
        {key: 'a', value: 'x', subject: 'a'},
        {key: 'b', value: 'y', subject: 'b'},
      ];
      const wrapper = mountWithTheme(<KeyValueList data={data} />);

      expect(wrapper.find('td.key').at(0).text()).toEqual('a');
      expect(wrapper.find('td.key').at(1).text()).toEqual('b');

      expect(wrapper.find('td.val').at(0).text()).toEqual('x');
      expect(wrapper.find('td.val').at(1).text()).toEqual('y');
    });

    it('should sort sort key/value pairs', function () {
      const data = [
        {key: 'b', value: 'y', subject: 'b'},
        {key: 'a', value: 'x', subject: 'a'},
      ];
      const wrapper = mountWithTheme(<KeyValueList data={data} />);

      expect(wrapper.find('td.key').at(0).text()).toEqual('a');
      expect(wrapper.find('td.key').at(1).text()).toEqual('b');

      expect(wrapper.find('td.val').at(0).text()).toEqual('x');
      expect(wrapper.find('td.val').at(1).text()).toEqual('y');
    });

    it('should use a single space for values that are an empty string', function () {
      const data = [
        {key: 'b', value: 'y', subject: 'b'},
        {key: 'a', value: '', subject: 'a'}, // empty string
      ];
      const wrapper = mountWithTheme(<KeyValueList data={data} />);

      expect(wrapper.find('td.key').at(0).text()).toEqual('a');
      expect(wrapper.find('td.key').at(1).text()).toEqual('b');

      expect(wrapper.find('td.val').at(0).text()).toEqual('');
      expect(wrapper.find('td.val').at(1).text()).toEqual('y');
    });

    it('can sort key/value pairs with non-string values', function () {
      const data = [
        {key: 'b', value: {foo: 'bar'}, subject: 'b'},
        {key: 'a', value: [3, 2, 1], subject: 'a'},
      ];
      const wrapper = mountWithTheme(<KeyValueList isContextData data={data} />);

      // Ignore values, more interested in if keys rendered + are sorted
      expect(wrapper.find('td.key').at(0).text()).toEqual('a');
      expect(wrapper.find('td.key').at(1).text()).toEqual('b');
    });

    it('should coerce non-strings into strings', function () {
      const data = [{key: 'a', value: false, subject: 'a'}];
      const wrapper = mountWithTheme(<KeyValueList data={data} />);

      expect(wrapper.find('td.key').at(0).text()).toEqual('a');
      expect(wrapper.find('td.val').at(0).text()).toEqual('false');
    });

    it("shouldn't blow up on null", function () {
      const data = [{key: 'a', value: null, subject: 'a'}];
      const wrapper = mountWithTheme(<KeyValueList data={data} />);

      expect(wrapper.find('td.key').at(0).text()).toEqual('a');
      expect(wrapper.find('td.val').at(0).text()).toEqual('null');
    });
  });
});
