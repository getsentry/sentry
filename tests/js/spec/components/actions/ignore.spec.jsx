import React from 'react';
import {mount} from 'enzyme';
import $ from 'jquery';
import IgnoreActions from 'app/components/actions/ignore';

describe('IgnoreActions', function() {
  let routerContext = TestStubs.routerContext();
  describe('disabled', function() {
    let component, button;
    let spy = sinon.stub();

    beforeEach(function() {
      component = mount(<IgnoreActions onUpdate={spy} disabled={true} />, routerContext);
      button = component.find('a.btn.btn-default').first();
    });

    it('has disabled prop', function() {
      expect(button.prop('disabled')).toBe(true);
    });

    it('does not call onUpdate when clicked', function() {
      button.simulate('click');
      expect(spy.notCalled).toBe(true);
    });
  });

  describe('ignored', function() {
    let component;
    let spy = sinon.spy();
    beforeEach(function() {
      component = mount(<IgnoreActions onUpdate={spy} isIgnored={true} />, routerContext);
    });

    it('displays ignored view', function() {
      let button = component.find('a.btn.active');
      expect(button).toHaveLength(1);
      expect(button.text()).toBe('');
    });

    it('calls onUpdate with unresolved status when clicked', function() {
      component.find('a.btn.active').simulate('click');
      expect(spy.calledWith({status: 'unresolved'})).toBeTruthy();
    });
  });

  describe('without confirmation', function() {
    let component;
    let spy = sinon.stub();

    beforeEach(function() {
      component = mount(<IgnoreActions onUpdate={spy} />, routerContext);
    });

    it('renders', function() {
      expect(component).toMatchSnapshot();
    });

    it('calls spy with ignore details when clicked', function() {
      let button = component.find('a.btn.btn-default').first();
      button.simulate('click');
      expect(spy.calledOnce).toBe(true);
      expect(spy.calledWith({status: 'ignored'})).toBe(true);
    });
  });

  describe('with confirmation step', function() {
    let component, button;
    let spy = sinon.stub();

    beforeEach(function() {
      component = mount(
        <IgnoreActions onUpdate={spy} shouldConfirm={true} confirmMessage={'Yoooooo'} />,
        routerContext
      );
      button = component.find('a.btn.btn-default').first();
    });

    it('renders', function() {
      expect(component).toMatchSnapshot();
    });

    it('displays confirmation modal with message provided', function() {
      button.simulate('click');

      let modal = $(document.body).find('.modal');
      expect(modal.text()).toContain('Yoooooo');
      expect(spy.notCalled).toBe(true);
      $(document.body)
        .find('.modal button:contains("Ignore")')
        .click();

      expect(spy.called).toBe(true);
    });
  });
});
