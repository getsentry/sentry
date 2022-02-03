import {Fragment} from 'react';
import {act} from 'react-dom/test-utils';

import {mountWithTheme} from 'sentry-test/enzyme';
import {selectByValue} from 'sentry-test/select-new';

import ResolveActions from 'sentry/components/actions/resolve';
import GlobalModal from 'sentry/components/globalModal';

describe('ResolveActions', function () {
  describe('disabled', function () {
    let component, button;
    const spy = jest.fn();

    beforeEach(function () {
      component = mountWithTheme(
        <ResolveActions
          onUpdate={spy}
          disabled
          hasRelease={false}
          orgSlug="org-1"
          projectSlug="proj-1"
        />,
        TestStubs.routerContext()
      );
      button = component.find('ResolveButton').first();
    });

    it('has disabled prop', function () {
      expect(button.props().disabled).toBe(true);
    });

    it('does not call onUpdate when clicked', function () {
      button.simulate('click');
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('disableDropdown', function () {
    let component, button;
    const spy = jest.fn();

    beforeEach(function () {
      component = mountWithTheme(
        <ResolveActions
          onUpdate={spy}
          disableDropdown
          hasRelease={false}
          orgSlug="org-1"
          projectSlug="proj-1"
        />,
        TestStubs.routerContext()
      );
    });

    it('main button is enabled', function () {
      button = component.find('ResolveButton');
      expect(button.prop('disabled')).toBeFalsy();
    });

    it('main button calls onUpdate when clicked', function () {
      button = component.find('ResolveButton');
      button.simulate('click');
      expect(spy).toHaveBeenCalled();
    });

    it('dropdown menu is disabled', function () {
      button = component.find('DropdownTrigger');
      expect(button.props().disabled).toBe(true);
    });
  });

  describe('resolved', function () {
    let component;
    const spy = jest.fn();
    beforeEach(function () {
      component = mountWithTheme(
        <ResolveActions
          onUpdate={spy}
          disabled
          hasRelease={false}
          orgSlug="org-1"
          projectSlug="proj-1"
          isResolved
        />,
        TestStubs.routerContext()
      );
    });

    it('displays resolved view', function () {
      const button = component.find('button[aria-label="Unresolve"]').first();
      expect(button).toHaveLength(1);
      expect(button.text()).toBe('');
    });

    it('calls onUpdate with unresolved status when clicked', function () {
      component.find('button[aria-label="Unresolve"]').last().simulate('click');
      expect(spy).toHaveBeenCalledWith({status: 'unresolved'});
    });
  });

  describe('auto resolved', function () {
    it('cannot be unresolved manually', function () {
      const spy = jest.fn();
      const component = mountWithTheme(
        <ResolveActions
          onUpdate={spy}
          disabled
          hasRelease={false}
          orgSlug="org-1"
          projectSlug="proj-1"
          isResolved
          isAutoResolved
        />,
        TestStubs.routerContext()
      );

      component.find('button[aria-label="Unresolve"]').simulate('click');
      expect(spy).not.toHaveBeenCalled();
    });
  });

  describe('without confirmation', function () {
    let component;
    const spy = jest.fn();
    beforeEach(function () {
      component = mountWithTheme(
        <ResolveActions
          onUpdate={spy}
          hasRelease={false}
          orgSlug="org-1"
          projectSlug="proj-1"
        />,
        TestStubs.routerContext()
      );
    });

    it('renders', function () {
      expect(component).toSnapshot();
    });

    it('calls spy with resolved status when clicked', function () {
      const button = component.find('ResolveButton');
      button.simulate('click');
      expect(spy).toHaveBeenCalledTimes(1);
      expect(spy).toHaveBeenCalledWith({status: 'resolved'});
    });
  });

  describe('with confirmation step', function () {
    let component, button;
    const spy = jest.fn();

    beforeEach(function () {
      component = mountWithTheme(
        <Fragment>
          <GlobalModal />
          <ResolveActions
            onUpdate={spy}
            hasRelease={false}
            orgSlug="org-1"
            projectSlug="proj-1"
            shouldConfirm
            confirmMessage="Are you sure???"
          />
        </Fragment>,
        TestStubs.routerContext()
      );
    });

    it('renders', function () {
      expect(component).toSnapshot();
    });

    it('displays confirmation modal with message provided', async function () {
      button = component.find('ResolveButton').first();
      button.simulate('click');

      await tick();
      component.update();

      const modal = component.find('Modal');
      expect(modal.text()).toContain('Are you sure???');
      expect(spy).not.toHaveBeenCalled();
      modal.find('button[aria-label="Resolve"]').simulate('click');

      expect(spy).toHaveBeenCalled();
    });
  });

  it('can resolve in "another version"', async function () {
    const onUpdate = jest.fn();
    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/releases/',
      body: [TestStubs.Release()],
    });
    const wrapper = mountWithTheme(
      <Fragment>
        <GlobalModal />
        <ResolveActions
          hasRelease
          orgSlug="org-slug"
          projectSlug="project-slug"
          onUpdate={onUpdate}
        />
      </Fragment>,
      TestStubs.routerContext()
    );

    // Necessary wrapper to simulate click event on dropdown menu buttons,
    // see: https://react-spectrum.adobe.com/react-spectrum/testing.html#triggering-events
    const triggerPress = element => {
      element.prop('onClick')({
        button: 0,
        detail: 0,
        nativeEvent: {detail: 0},
        currentTarget: element.getDOMNode(),
        target: element.getDOMNode(),
        stopPropagation: () => {},
      });
    };

    await act(async () => {
      triggerPress(wrapper.find('DropdownTrigger'));
      await tick();
      wrapper.update();

      triggerPress(wrapper.find('MenuItemWrap').last());
      await tick();
      wrapper.update();
    });

    expect(wrapper.find('CustomResolutionModal Select').prop('options')).toEqual([
      expect.objectContaining({
        value: 'sentry-android-shop@1.2.0',
        label: expect.anything(),
      }),
    ]);

    selectByValue(wrapper, 'sentry-android-shop@1.2.0', {
      selector: 'SelectAsyncControl[name="version"]',
    });

    wrapper.find('CustomResolutionModal form').simulate('submit');
    expect(onUpdate).toHaveBeenCalledWith({
      status: 'resolved',
      statusDetails: {
        inRelease: 'sentry-android-shop@1.2.0',
      },
    });
  });
});
