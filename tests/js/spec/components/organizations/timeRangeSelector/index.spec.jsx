import React from 'react';

import {mountWithTheme} from 'sentry-test/enzyme';

import ConfigStore from 'app/stores/configStore';
import TimeRangeSelector from 'app/components/organizations/timeRangeSelector';

describe('TimeRangeSelector', function() {
  let wrapper;
  const onChange = jest.fn();
  const routerContext = TestStubs.routerContext();

  const createWrapper = (props = {}) =>
    mountWithTheme(
      <TimeRangeSelector
        showAbsolute
        showRelative
        onChange={onChange}
        organization={TestStubs.Organization()}
        {...props}
      />,
      routerContext
    );

  beforeEach(function() {
    ConfigStore.loadInitialData({
      user: {options: {timezone: 'America/New_York'}},
    });
    onChange.mockReset();
  });

  it('renders when given relative period not in dropdown', function() {
    wrapper = mountWithTheme(
      <TimeRangeSelector showAbsolute={false} showRelative={false} relative="9d" />,
      routerContext
    );
    expect(wrapper.find('HeaderItem').text()).toEqual('Other');
  });

  it('renders when given an invalid relative period', function() {
    wrapper = mountWithTheme(
      <TimeRangeSelector showAbsolute={false} showRelative={false} relative="1w" />,
      routerContext
    );
    expect(wrapper.find('HeaderItem').text()).toEqual('Invalid period');
  });

  it('hides relative and absolute selectors', async function() {
    wrapper = mountWithTheme(
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
      start: new Date('2017-10-03T02:41:20.000Z'),
      end: new Date('2017-10-17T02:41:20.000Z'),
    };
    expect(onChange).toHaveBeenLastCalledWith(newProps);
    wrapper.setProps(newProps);
    wrapper.update();

    expect(wrapper.find('[data-test-id="date-range"]')).toHaveLength(1);
  });

  it('selects absolute item with utc enabled', async function() {
    wrapper = createWrapper({utc: true});
    await wrapper.find('HeaderItem').simulate('click');

    expect(wrapper.find('[data-test-id="date-range"]')).toHaveLength(0);
    await wrapper.find('SelectorItem[value="absolute"]').simulate('click');

    const newProps = {
      relative: null,
      start: new Date('2017-10-02T22:41:20.000Z'),
      end: new Date('2017-10-16T22:41:20.000Z'),
      utc: true,
    };
    expect(onChange).toHaveBeenLastCalledWith(newProps);
    wrapper.setProps(newProps);
    wrapper.update();

    expect(wrapper.find('[data-test-id="date-range"]')).toHaveLength(1);
  });

  it('switches from relative to absolute while maintaining equivalent date range', async function() {
    wrapper = createWrapper({
      relative: '7d',
      utc: false,
    });
    await wrapper.find('HeaderItem').simulate('click');

    wrapper.find('SelectorItem[value="absolute"]').simulate('click');
    expect(onChange).toHaveBeenCalledWith({
      relative: null,
      start: new Date('2017-10-10T02:41:20.000Z'),
      end: new Date('2017-10-17T02:41:20.000Z'),
      utc: false,
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
      start: new Date('2017-10-03T02:41:20.000Z'),
      end: new Date('2017-10-17T02:41:20.000Z'),
      utc: false,
    });
  });

  it('switches from relative to absolute while maintaining equivalent date range (in utc)', async function() {
    wrapper = createWrapper({
      relative: '7d',
      utc: true,
    });
    await wrapper.find('HeaderItem').simulate('click');

    wrapper.find('SelectorItem[value="absolute"]').simulate('click');
    expect(onChange).toHaveBeenCalledWith({
      relative: null,
      start: new Date('2017-10-09T22:41:20.000Z'),
      end: new Date('2017-10-16T22:41:20.000Z'),
      utc: true,
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
      start: new Date('2017-10-02T22:41:20.000Z'),
      end: new Date('2017-10-16T22:41:20.000Z'),
      utc: true,
    });
  });

  it('switches from relative to absolute and then toggling UTC (starting with UTC)', async function() {
    wrapper = createWrapper({
      relative: '7d',
      utc: true,
    });
    await wrapper.find('HeaderItem').simulate('click');

    // Local time is 22:41:20-0500 -- this is what date picker should show
    wrapper.find('SelectorItem[value="absolute"]').simulate('click');
    expect(onChange).toHaveBeenCalledWith({
      relative: null,
      start: new Date('2017-10-09T22:41:20.000Z'),
      end: new Date('2017-10-16T22:41:20.000Z'),
      utc: true,
    });

    wrapper.find('UtcPicker Checkbox').simulate('change');
    expect(onChange).toHaveBeenLastCalledWith({
      relative: null,
      start: new Date('2017-10-09T22:41:20.000Z'),
      end: new Date('2017-10-16T22:41:20.000Z'),
      utc: false,
    });

    wrapper.find('UtcPicker Checkbox').simulate('change');
    expect(onChange).toHaveBeenLastCalledWith({
      relative: null,
      start: new Date('2017-10-10T02:41:20.000Z'),
      end: new Date('2017-10-17T02:41:20.000Z'),
      utc: true,
    });
  });

  it('switches from relative to absolute and then toggling UTC (starting with non-UTC)', async function() {
    wrapper = createWrapper({
      relative: '7d',
      utc: false,
    });
    await wrapper.find('HeaderItem').simulate('click');

    wrapper.find('SelectorItem[value="absolute"]').simulate('click');
    expect(onChange).toHaveBeenCalledWith({
      relative: null,
      start: new Date('2017-10-09T22:41:20.000-0400'),
      end: new Date('2017-10-16T22:41:20.000-0400'),
      utc: false,
    });

    wrapper.find('UtcPicker Checkbox').simulate('change');
    expect(onChange).toHaveBeenLastCalledWith({
      relative: null,
      start: new Date('2017-10-10T02:41:20.000Z'),
      end: new Date('2017-10-17T02:41:20.000Z'),
      utc: true,
    });

    wrapper.find('UtcPicker Checkbox').simulate('change');
    expect(onChange).toHaveBeenLastCalledWith({
      relative: null,
      start: new Date('2017-10-09T22:41:20.000Z'),
      end: new Date('2017-10-16T22:41:20.000Z'),
      utc: false,
    });
  });

  it('maintains time when switching UTC to local time', async function() {
    // Times should never change when changing UTC option
    // Instead, the utc flagged is used when querying to create proper date

    let state;
    wrapper = createWrapper({
      relative: null,
      start: new Date('2017-10-10T00:00:00.000Z'),
      end: new Date('2017-10-17T23:59:59.000Z'),
      utc: true,
    });
    wrapper.find('HeaderItem').simulate('click');

    // Local
    wrapper.find('UtcPicker Checkbox').simulate('change');
    state = {
      relative: null,
      start: new Date('2017-10-10T00:00:00.000Z'),
      end: new Date('2017-10-17T23:59:59.000Z'),
      utc: false,
    };
    expect(onChange).toHaveBeenLastCalledWith(state);
    wrapper.setProps(state);

    // UTC
    wrapper.find('UtcPicker Checkbox').simulate('change');
    state = {
      relative: null,
      start: new Date('2017-10-10T00:00:00.000Z'),
      end: new Date('2017-10-17T23:59:59.000Z'),
      utc: true,
    };
    expect(onChange).toHaveBeenLastCalledWith(state);
    wrapper.setProps(state);

    // Local
    wrapper.find('UtcPicker Checkbox').simulate('change');
    expect(onChange).toHaveBeenLastCalledWith({
      relative: null,
      start: new Date('2017-10-10T00:00:00.000Z'),
      end: new Date('2017-10-17T23:59:59.000Z'),
      utc: false,
    });
  });

  it('deselects default filter when absolute date selected', async function() {
    wrapper = createWrapper({
      relative: '14d',
      utc: false,
    });

    await wrapper.find('HeaderItem').simulate('click');
    await wrapper.find('SelectorItem[value="absolute"]').simulate('click');

    expect(wrapper.find('SelectorItem[value="absolute"]').prop('selected')).toBe(true);
    expect(wrapper.find('SelectorItem[value="14d"]').prop('selected')).toBe(false);
  });
});
