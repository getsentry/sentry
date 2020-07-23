import React from 'react';

import {mount} from 'sentry-test/enzyme';

import FrameRegisters from 'app/components/events/interfaces/frameRegisters/frameRegisters';
import FrameRegistersValue from 'app/components/events/interfaces/frameRegisters/frameRegistersValue';

describe('FrameRegisters', () => {
  it('should render registers', () => {
    const registers = {
      r10: '0x00007fff9300bf70',
      r11: '0xffffffffffffffff',
      r12: '0x0000000000000000',
    };

    const wrapper = mount(<FrameRegisters data={registers} />);
    expect(wrapper.find('[data-test-id="frame-registers-value"]')).toSnapshot();
    expect(wrapper.find('[data-test-id="frame-registers-value"]')).toMatchSnapshot();
  });

  it('should skip registers without a value', () => {
    const registers = {
      r10: '0x00007fff9300bf70',
      r11: null,
      r12: '0x0000000000000000',
    };

    const wrapper = mount(<FrameRegisters data={registers} />);
    expect(wrapper.find('[data-test-id="frame-registers-value"]')).toSnapshot();
    expect(wrapper.find('[data-test-id="frame-registers-value"]')).toMatchSnapshot();
  });
});

describe('RegisterValue', () => {
  let wrapper;
  describe('with string value', () => {
    beforeEach(() => {
      wrapper = mount(<FrameRegistersValue value="0x000000000000000a" />);
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
      wrapper = mount(<FrameRegistersValue value={10} />);
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
      wrapper = mount(<FrameRegistersValue value="xyz" />);
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
