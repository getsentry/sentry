import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';
import {mountGlobalModal} from 'sentry-test/modal';

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
      button = component.find('button[aria-label="Ignore"]').first();
    });

    it('has disabled prop', function () {
      expect(button.props()['aria-disabled']).toBe(true);
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
      component = mountWithTheme(<IgnoreActions onUpdate={spy} />, routerContext);
    });

    it('calls spy with ignore details when clicked', function () {
      const button = component.find('button[aria-label="Ignore"]').first();
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
        <IgnoreActions onUpdate={spy} shouldConfirm confirmMessage="confirm me" />,
        routerContext
      );
      button = component.find('button[aria-label="Ignore"]');
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
