import React from 'react';
import {shallow} from 'enzyme';

import KeyValueList from 'app/components/events/interfaces/keyValueList';

describe('KeyValueList', function () {
  describe('render', function () {
    it('should render a definition list of key/value pairs', function () {
      let data = [
        ['a', 'x'], ['b', 'y']
      ];
      let wrapper = shallow(<KeyValueList data={data} />);

      expect(wrapper.find('.key').at(0).text()).to.eql('a');
      expect(wrapper.find('.key').at(1).text()).to.eql('b');

      expect(wrapper.find('.value').at(0).text()).to.eql('x');
      expect(wrapper.find('.value').at(1).text()).to.eql('y');
    });

    it('should sort sort key/value pairs', function () {
      let data = [
        ['b', 'y'], ['a', 'x']
      ];
      let wrapper = shallow(<KeyValueList data={data} />);

      expect(wrapper.find('.key').at(0).text()).to.eql('a');
      expect(wrapper.find('.key').at(1).text()).to.eql('b');

      expect(wrapper.find('.value').at(0).text()).to.eql('x');
      expect(wrapper.find('.value').at(1).text()).to.eql('y');
    });

    it('should use a single space for values that are an empty string', function () {
      let data = [
        ['b', 'y'], ['a', ''] // empty string
      ];
      let wrapper = shallow(<KeyValueList data={data} />);

      expect(wrapper.find('.key').at(0).text()).to.eql('a');
      expect(wrapper.find('.key').at(1).text()).to.eql('b');

      expect(wrapper.find('.value').at(0).text()).to.eql(' ');
      expect(wrapper.find('.value').at(1).text()).to.eql('y');
    });

    it('should coerce non-strings into strings', function () {
      let data = [
        ['a', false]
      ];
      let wrapper = shallow(<KeyValueList data={data} />);

      expect(wrapper.find('.key').at(0).text()).to.eql('a');
      expect(wrapper.find('.value').at(0).text()).to.eql('false');
    });

    it('shouldn\'t blow up on null', function () {
      let data = [
        ['a', null]
      ];
      let wrapper = shallow(<KeyValueList data={data} />);

      expect(wrapper.find('.key').at(0).text()).to.eql('a');
      expect(wrapper.find('.value').at(0).text()).to.eql('null');
    });
  });
});
