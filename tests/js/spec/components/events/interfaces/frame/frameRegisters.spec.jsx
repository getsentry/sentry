import {mountWithTheme} from 'sentry-test/enzyme';

import FrameRegisters from 'sentry/components/events/interfaces/frame/frameRegisters';
import FrameRegistersValue from 'sentry/components/events/interfaces/frame/frameRegisters/value';

describe('FrameRegisters', () => {
  it('should render registers', () => {
    const registers = {
      r10: '0x00007fff9300bf70',
      r11: '0xffffffffffffffff',
      r12: '0x0000000000000000',
    };

    const wrapper = mountWithTheme(<FrameRegisters registers={registers} />);
    expect(wrapper.find('[data-test-id="frame-registers-value"]')).toSnapshot();
  });

  it('should skip registers without a value', () => {
    const registers = {
      r10: '0x00007fff9300bf70',
      r11: null,
      r12: '0x0000000000000000',
    };

    const wrapper = mountWithTheme(<FrameRegisters registers={registers} />);
    expect(wrapper.find('[data-test-id="frame-registers-value"]')).toSnapshot();
  });
});

describe('RegisterValue', () => {
  let wrapper;
  describe('with string value', () => {
    beforeEach(() => {
      wrapper = mountWithTheme(<FrameRegistersValue value="0x000000000000000a" />);
    });

    it('should display the hexadecimal value', () => {
      expect(wrapper.text()).toBe('0x000000000000000a');
    });

    it('should display the numeric value', () => {
      wrapper.find('svg[aria-label="Toggle register value format"]').simulate('click');
      expect(wrapper.text()).toBe('10');
    });
  });

  describe('with numeric value', () => {
    beforeEach(() => {
      wrapper = mountWithTheme(<FrameRegistersValue value={10} />);
    });

    it('should display the hexadecimal value', () => {
      expect(wrapper.text()).toBe('0x000000000000000a');
    });

    it('should display the numeric value', () => {
      wrapper.find('svg[aria-label="Toggle register value format"]').simulate('click');
      expect(wrapper.text()).toBe('10');
    });
  });

  describe('with unknown value', () => {
    beforeEach(() => {
      wrapper = mountWithTheme(<FrameRegistersValue value="xyz" />);
    });

    it('should display the hexadecimal value', () => {
      expect(wrapper.text()).toBe('xyz');
    });

    it('should display the numeric value', () => {
      wrapper.find('svg[aria-label="Toggle register value format"]').simulate('click');
      expect(wrapper.text()).toBe('xyz');
    });
  });
});
