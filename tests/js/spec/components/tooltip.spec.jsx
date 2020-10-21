import {mount, mountWithTheme} from 'sentry-test/enzyme';

import Tooltip from 'app/components/tooltip';

describe('Tooltip', function () {
  it('renders', function () {
    const wrapper = mountWithTheme(
      <Tooltip title="test">
        <span>My Button</span>
      </Tooltip>
    );
    expect(wrapper).toSnapshot();
  });

  it('updates title', function () {
    const wrapper = mountWithTheme(
      <Tooltip title="test">
        <span>My Button</span>
      </Tooltip>,
      TestStubs.routerContext()
    );

    wrapper.setProps({title: 'bar'});
    wrapper.update();
    const trigger = wrapper.find('span');
    trigger.simulate('mouseEnter');

    const tooltip = document.querySelector('#tooltip-portal .tooltip-content');
    // Check the text node.
    expect(tooltip.childNodes[0].nodeValue).toEqual('bar');

    trigger.simulate('mouseLeave');
  });

  it('disables and does not render', function () {
    const wrapper = mount(
      <Tooltip title="test" disabled>
        <span>My Button</span>
      </Tooltip>,
      TestStubs.routerContext()
    );
    const trigger = wrapper.find('span');
    trigger.simulate('mouseEnter');

    const tooltip = document.querySelector('#tooltip-portal .tooltip-content');
    expect(tooltip).toBeFalsy();

    trigger.simulate('mouseLeave');
  });

  it('does not render an empty tooltip', function () {
    const wrapper = mountWithTheme(
      <Tooltip title="">
        <span>My Button</span>
      </Tooltip>,
      TestStubs.routerContext()
    );
    const trigger = wrapper.find('span');
    trigger.simulate('mouseEnter');

    const tooltipContent = wrapper.find('TooltipContent');
    expect(tooltipContent.prop('hide')).toBe(true);

    trigger.simulate('mouseLeave');
  });
});
