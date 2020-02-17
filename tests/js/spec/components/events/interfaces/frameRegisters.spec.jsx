import React from 'react';
import {shallow, mount} from 'sentry-test/enzyme';

import FrameRegisters from 'app/components/events/interfaces/frameRegisters';
import RegisterValue from 'app/components/events/interfaces/frameRegisters/registerValue';

describe('FrameRegisters', () => {
  it('should render registers', () => {
    const registers = {
      r10: '0x00007fff9300bf70',
      r11: '0xffffffffffffffff',
      r12: '0x0000000000000000',
    };

    const wrapper = shallow(<FrameRegisters data={registers} />);
    expect(wrapper.find('RegisterValue')).toMatchSnapshot();
  });

  it('should skip registers without a value', () => {
    const registers = {
      r10: '0x00007fff9300bf70',
      r11: null,
      r12: '0x0000000000000000',
    };

    const wrapper = shallow(<FrameRegisters data={registers} />);
    expect(wrapper.find('RegisterValue')).toMatchSnapshot();
  });
});

describe('RegisterValue', () => {
  let wrapper;
  describe('with string value', () => {
    beforeEach(() => {
      wrapper = mount(<RegisterValue value="0x000000000000000a" />);
    });

    it('should display the hexadecimal value', () => {
      expect(wrapper.text()).toBe('0x000000000000000a');
    });

    it('should display the numeric value', () => {
      wrapper.find('Toggle').simulate('click');
      expect(wrapper.text()).toBe('10');
    });
  });

  describe('with numeric value', () => {
    beforeEach(() => {
      wrapper = mount(<RegisterValue value={10} />);
    });

    it('should display the hexadecimal value', () => {
      expect(wrapper.text()).toBe('0x000000000000000a');
    });

    it('should display the numeric value', () => {
      wrapper.find('Toggle').simulate('click');
      expect(wrapper.text()).toBe('10');
    });
  });

  describe('with unknown value', () => {
    beforeEach(() => {
      wrapper = mount(<RegisterValue value="xyz" />);
    });

    it('should display the hexadecimal value', () => {
      expect(wrapper.text()).toBe('xyz');
    });

    it('should display the numeric value', () => {
      wrapper.find('Toggle').simulate('click');
      expect(wrapper.text()).toBe('xyz');
    });
  });
});
