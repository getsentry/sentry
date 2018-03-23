import React from 'react';
import {mount} from 'enzyme';
import $ from 'jquery';
import ResolveActions from 'app/components/actions/resolve';

describe('ResolveActions', function() {
  describe('disabled', function() {
    let component, button;
    let spy = sinon.stub();

    beforeEach(function() {
      component = mount(
        <ResolveActions
          onUpdate={spy}
          disabled={true}
          hasRelease={false}
          orgId={'org-1'}
          projectId={'proj-1'}
        />,
        TestStubs.routerContext()
      );
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

  describe('resolved', function() {
    let component;
    let spy = sinon.stub();
    beforeEach(function() {
      component = mount(
        <ResolveActions
          onUpdate={spy}
          disabled={true}
          hasRelease={false}
          orgId={'org-1'}
          projectId={'proj-1'}
          isResolved={true}
        />,
        TestStubs.routerContext()
      );
    });

    it('displays resolved view', function() {
      let button = component.find('a.btn.active');
      expect(button).toHaveLength(1);
      expect(button.text()).toBe('');
    });

    it('calls onUpdate with unresolved status when clicked', function() {
      component.find('a.btn.active').simulate('click');
      expect(spy.calledWith({status: 'unresolved'})).toBeTruthy();
    });
  });

  describe('auto resolved', function() {
    it('cannot be unresolved manually', function() {
      let spy = sinon.stub();
      let component = mount(
        <ResolveActions
          onUpdate={spy}
          disabled={true}
          hasRelease={false}
          orgId={'org-1'}
          projectId={'proj-1'}
          isResolved={true}
          isAutoResolved={true}
        />,
        TestStubs.routerContext()
      );

      component.find('a.btn').simulate('click');
      expect(spy.notCalled).toBe(true);
    });
  });

  describe('without confirmation', function() {
    let component;
    let spy = sinon.stub();
    beforeEach(function() {
      component = mount(
        <ResolveActions
          onUpdate={spy}
          hasRelease={false}
          orgId={'org-1'}
          projectId={'proj-1'}
        />,
        TestStubs.routerContext()
      );
    });

    it('renders', function() {
      expect(component).toMatchSnapshot();
    });

    it('calls spy with resolved status when clicked', function() {
      let button = component.find('a.btn.btn-default').first();
      button.simulate('click');
      expect(spy.calledOnce).toBe(true);
      expect(spy.calledWith({status: 'resolved'})).toBe(true);
    });
  });

  describe('with confirmation step', function() {
    let component, button;
    let spy = sinon.stub();

    beforeEach(function() {
      component = mount(
        <ResolveActions
          onUpdate={spy}
          hasRelease={false}
          orgId={'org-1'}
          projectId={'proj-1'}
          shouldConfirm={true}
          confirmMessage={'Are you sure???'}
        />,
        TestStubs.routerContext()
      );
      button = component.find('a.btn.btn-default').first();
    });

    it('renders', function() {
      expect(component).toMatchSnapshot();
    });

    it('displays confirmation modal with message provided', function() {
      button.simulate('click');

      let modal = $(document.body).find('.modal');
      expect(modal.text()).toContain('Are you sure???');
      expect(spy.notCalled).toBe(true);
      $(document.body)
        .find('.modal button:contains("Resolve")')
        .click();

      expect(spy.called).toBe(true);
    });
  });
});
