import React from 'react';

import {shallow} from 'sentry-test/enzyme';

import SnoozeActionModal from 'app/components/issues/snoozeActionModal';

const modalProps = {
  Body: p => p.children,
  Footer: p => p.children,
};

describe('SnoozeActionModal', function () {
  beforeEach(function () {});

  afterEach(function () {});

  describe('render()', function () {
    it('should show a gravatar when avatar type is gravatar', function () {
      const wrapper = shallow(
        <SnoozeActionModal {...modalProps} onSnooze={function () {}} />
      );
      expect(wrapper.find('h5').text()).toEqual('How long should we ignore this issue?');
    });
  });

  describe('click handlers', function () {
    it('30m link should call prop w/ value 30', function () {
      const snooze = jest.fn();
      const close = jest.fn();

      const wrapper = shallow(
        <SnoozeActionModal {...modalProps} closeModal={close} onSnooze={snooze} />
      );

      wrapper.find('ul').childAt(0).find('a').simulate('click');

      expect(snooze).toHaveBeenCalledWith(30);
      expect(close).toHaveBeenCalled();
    });

    it('forever link should call prop w/ value undefined', function () {
      const snooze = jest.fn();
      const close = jest.fn();

      const wrapper = shallow(
        <SnoozeActionModal {...modalProps} closeModal={close} onSnooze={snooze} />
      );

      wrapper.find('ul').childAt(3).find('a').simulate('click');

      expect(snooze).toHaveBeenCalledWith(undefined);
      expect(close).toHaveBeenCalled();
    });
  });
});
