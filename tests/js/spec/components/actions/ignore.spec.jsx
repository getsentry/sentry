import $ from 'jquery';

import {mountWithTheme} from 'sentry-test/enzyme';

import IgnoreActions from 'app/components/actions/ignore';

describe('IgnoreActions', function () {
  const routerContext = TestStubs.routerContext();

  describe('disabled', function () {
    let component, button;
    const spy = jest.fn();

    beforeEach(function () {
      component = mountWithTheme(
        <IgnoreActions onUpdate={spy} disabled />,
        routerContext
      );
      button = component.find('a.btn.btn-default').first();
    });

    it('has disabled prop', function () {
      expect(button.prop('disabled')).toBe(true);
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
      component = mountWithTheme(
        <IgnoreActions onUpdate={spy} isIgnored />,
        routerContext
      );
    });

    it('displays ignored view', function () {
      const button = component.find('a.btn.active');
      expect(button).toHaveLength(1);
      expect(button.text()).toBe('');
    });

    it('calls onUpdate with unresolved status when clicked', function () {
      component.find('a.btn.active').simulate('click');
      expect(spy).toHaveBeenCalledWith({status: 'unresolved'});
    });
  });

  describe('without confirmation', function () {
    let component;
    const spy = jest.fn();

    beforeEach(function () {
      component = mountWithTheme(<IgnoreActions onUpdate={spy} />, routerContext);
    });

    it('calls spy with ignore details when clicked', function () {
      const button = component.find('a.btn.btn-default').first();
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
        <IgnoreActions onUpdate={spy} shouldConfirm confirmMessage="Yoooooo" />,
        routerContext
      );
      button = component.find('a.btn.btn-default').first();
    });

    it('displays confirmation modal with message provided', function () {
      button.simulate('click');

      const modal = $(document.body).find('.modal');
      expect(modal.text()).toContain('Yoooooo');
      expect(spy).not.toHaveBeenCalled();
      $(document.body).find('.modal button:contains("Ignore")').click();

      expect(spy).toHaveBeenCalled();
    });
  });
});
