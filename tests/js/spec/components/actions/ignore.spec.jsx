import {mountWithTheme} from 'sentry-test/enzyme';
import {mountGlobalModal} from 'sentry-test/modal';

import IgnoreActions from 'sentry/components/actions/ignore';

describe('IgnoreActions', function () {
  describe('disabled', function () {
    let component, button;
    const spy = jest.fn();

    beforeEach(function () {
      component = mountWithTheme(<IgnoreActions onUpdate={spy} disabled />);
      button = component.find('IgnoreButton');
    });

    it('has disabled prop', function () {
      expect(button.props().disabled).toBe(true);
    });

    it('does not call onUpdate when clicked', function () {
      button.simulate('click');
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('ignored', function () {
    let component;
    const spy = jest.fn();
    beforeEach(function () {
      component = mountWithTheme(<IgnoreActions onUpdate={spy} isIgnored />);
    });

    it('displays ignored view', function () {
      const button = component.find('button[aria-label="Unignore"]');
      expect(button).toHaveLength(1);
      // Shows icon only
      expect(button.text()).toBe('');
    });

    it('calls onUpdate with unresolved status when clicked', function () {
      component.find('button[aria-label="Unignore"]').simulate('click');
      expect(spy).toHaveBeenCalledWith({status: 'unresolved'});
    });
  });

  describe('without confirmation', function () {
    let component;
    const spy = jest.fn();

    beforeEach(function () {
      component = mountWithTheme(<IgnoreActions onUpdate={spy} />);
    });

    it('calls spy with ignore details when clicked', function () {
      const button = component.find('IgnoreButton').first();
      button.simulate('click');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({status: 'ignored'});
    });
  });

  describe('with confirmation step', function () {
    let component, button;
    const spy = jest.fn();

    beforeEach(function () {
      component = mountWithTheme(
        <IgnoreActions onUpdate={spy} shouldConfirm confirmMessage="confirm me" />
      );
      button = component.find('IgnoreButton');
    });

    it('displays confirmation modal with message provided', async function () {
      button.simulate('click');

      const modal = await mountGlobalModal();

      expect(modal.text()).toContain('confirm me');
      expect(spy).not.toHaveBeenCalled();
      modal.find('Button[priority="primary"]').simulate('click');

      expect(spy).toHaveBeenCalled();
    });
  });
});
