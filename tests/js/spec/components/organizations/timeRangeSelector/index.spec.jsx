import React from 'react';

import {mount} from 'enzyme';
import TimeRangeSelector from 'app/components/organizations/timeRangeSelector';

describe('TimeRangeSelector', function() {
  let wrapper;
  let onChange = jest.fn();
  let routerContext = TestStubs.routerContext();

  const createWrapper = (props = {}) =>
    mount(
      <TimeRangeSelector showAbsolute showRelative onChange={onChange} {...props} />,
      routerContext
    );

  beforeEach(function() {
    onChange.mockReset();
  });

  it('hides relative and absolute selectors', async function() {
    wrapper = mount(
      <TimeRangeSelector showAbsolute={false} showRelative={false} />,
      routerContext
    );
    await wrapper.find('HeaderItem').simulate('click');
    expect(wrapper.find('RelativeSelector SelectorItem')).toHaveLength(0);
    expect(wrapper.find('SelectorItem[value="absolute"]')).toHaveLength(0);
  });

  it('selects absolute item', async function() {
    wrapper = createWrapper();
    await wrapper.find('HeaderItem').simulate('click');

    expect(wrapper.find('[data-test-id="date-range"]')).toHaveLength(0);
    await wrapper.find('SelectorItem[value="absolute"]').simulate('click');

    const newProps = {
      relative: null,
      start: new Date('2017-10-02T04:00:00.000Z'),
      end: new Date('2017-10-16T04:00:00.000Z'),
    };
    expect(onChange).toHaveBeenLastCalledWith(newProps);
    wrapper.setProps(newProps);
    wrapper.update();

    expect(wrapper.find('[data-test-id="date-range"]')).toHaveLength(1);
  });

  it('switches from relative to absolute while maintaining equivalent date range', async function() {
    wrapper = createWrapper({
      relative: '7d',
    });
    await wrapper.find('HeaderItem').simulate('click');

    wrapper.find('SelectorItem[value="absolute"]').simulate('click');
    expect(onChange).toHaveBeenCalledWith({
      relative: null,
      start: new Date(1507521600000),
      end: new Date(1508126400000),
    });

    wrapper.find('SelectorItem[value="14d"]').simulate('click');
    expect(onChange).toHaveBeenLastCalledWith({
      relative: '14d',
      start: null,
      end: null,
    });

    wrapper.setProps({relative: '14d', start: null, end: null});
    await wrapper.find('HeaderItem').simulate('click');
    wrapper.find('SelectorItem[value="absolute"]').simulate('click');
    expect(onChange).toHaveBeenLastCalledWith({
      relative: null,
      start: new Date(1506916800000),
      end: new Date(1508126400000),
    });
  });
});
