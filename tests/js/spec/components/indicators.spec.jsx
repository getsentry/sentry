import {mount} from 'sentry-test/enzyme';

import Indicators from 'app/components/indicators';
import IndicatorStore from 'app/stores/indicatorStore';
import {
  clearIndicators,
  addSuccessMessage,
  addErrorMessage,
  addMessage,
} from 'app/actionCreators/indicator';

// Make sure we use `duration: null` to test add/remove
jest.useFakeTimers();

describe('Indicators', function () {
  let wrapper;
  beforeEach(function () {
    wrapper = mount(<Indicators />, TestStubs.routerContext());

    clearIndicators();
    jest.runAllTimers();
  });

  it('renders nothing by default', function () {
    expect(wrapper.find('ToastIndicator')).toHaveLength(0);
  });

  it('has a loading indicator by default', function () {
    // when "type" is empty, we should treat it as loading state
    IndicatorStore.add('Loading');
    wrapper.update();
    expect(wrapper.find('ToastIndicator')).toHaveLength(1);
  });

  it('adds and removes a toast by calling IndicatorStore directly', function () {
    // when "type" is empty, we should treat it as loading state
    const indicator = IndicatorStore.add('Loading');
    wrapper.update();
    expect(wrapper.find('ToastIndicator')).toHaveLength(1);
    expect(wrapper.find('Message').text()).toBe('Loading');

    jest.runAllTimers();
    wrapper.update();
    expect(wrapper.find('ToastIndicator')).toHaveLength(1);

    // Old indicator gets replaced when a new one is added
    IndicatorStore.remove(indicator);
    jest.runAllTimers();
    wrapper.update();
    expect(wrapper.find('ToastIndicator div').first().prop('style').opacity).toBe(0);
  });

  // This is a common pattern used throughout the code for API calls
  it('adds and replaces toast by calling IndicatorStore directly', function () {
    IndicatorStore.add('Loading');
    wrapper.update();
    expect(wrapper.find('ToastIndicator')).toHaveLength(1);
    expect(wrapper.find('Message').text()).toBe('Loading');

    // Old indicator gets replaced when a new one is added
    IndicatorStore.add('success', 'success');
    jest.runAllTimers();
    wrapper.update();
    expect(wrapper.find('ToastIndicator')).toHaveLength(1);
    expect(wrapper.find('Message').text()).toBe('success');
  });

  it('does not have loading indicator when "type" is empty (default)', function () {
    addMessage('Loading', '', {duration: null});
    jest.runAllTimers();
    wrapper.update();
    expect(wrapper.find('LoadingIndicator')).toHaveLength(0);
  });

  it('has a loading indicator when type is "loading"', function () {
    addMessage('Loading', 'loading', {duration: null});
    jest.runAllTimers();
    wrapper.update();
    expect(wrapper.find('LoadingIndicator')).toHaveLength(1);
  });

  it('adds and removes toast by calling action creators', function () {
    // action creators don't return anything
    addMessage('Loading', '', {duration: null});
    jest.runAllTimers();
    wrapper.update();
    expect(wrapper.find('ToastIndicator')).toHaveLength(1);
    expect(wrapper.find('Message').text()).toBe('Loading');

    // If no indicator is specified, will remove all indicators
    clearIndicators();
    jest.runAllTimers();
    wrapper.update();
    expect(wrapper.find('ToastIndicator div').first().prop('style').opacity).toBe(0);
  });

  it('adds and replaces toast by calling action creators', function () {
    addMessage('Loading', '', {duration: null});
    jest.runAllTimers();
    wrapper.update();
    expect(wrapper.find('ToastIndicator')).toHaveLength(1);
    expect(wrapper.find('Message').text()).toBe('Loading');

    // Old indicator gets replaced when a new one is added
    addMessage('success', 'success', {duration: null});
    jest.runAllTimers();
    wrapper.update();
    expect(wrapper.find('ToastIndicator')).toHaveLength(1);
    expect(wrapper.find('Message').text()).toBe('success');
  });

  it('adds and replaces toasts by calling action creators helpers', function () {
    // Old indicator gets replaced when a new one is added
    addSuccessMessage('success');
    jest.runAllTimers();
    wrapper.update();
    expect(wrapper.find('ToastIndicator')).toHaveLength(1);
    expect(wrapper.find('Message').text()).toBe('success');

    clearIndicators();
    addErrorMessage('error');
    jest.runAllTimers();
    wrapper.update();
    expect(wrapper.find('ToastIndicator')).toHaveLength(1);
    expect(wrapper.find('Message').text()).toBe('error');
  });

  it('appends toasts', function () {
    addMessage('Loading', '', {append: true, duration: null});
    jest.runAllTimers();
    wrapper.update();
    expect(wrapper.find('ToastIndicator')).toHaveLength(1);
    expect(wrapper.find('Message').text()).toBe('Loading');

    addMessage('Success', 'success', {append: true, duration: null});
    jest.runAllTimers();
    wrapper.update();
    expect(wrapper.find('ToastIndicator')).toHaveLength(2);
    // Toasts get appended to the end
    expect(wrapper.find('Message').at(1).text()).toBe('Success');

    addMessage('Error', 'error', {append: true, duration: null});
    jest.runAllTimers();
    wrapper.update();
    expect(wrapper.find('ToastIndicator')).toHaveLength(3);
    // Toasts get appended to the end
    expect(wrapper.find('Message').at(2).text()).toBe('Error');

    // clears all toasts
    clearIndicators();
    jest.runAllTimers();
    wrapper.update();
    expect(
      wrapper
        .find('ToastIndicator div[style]')
        .everyWhere(div => div.prop('style').opacity === 0)
    ).toBe(true);
  });

  it('dismisses on click', function () {
    addMessage('Loading', '', {append: true, duration: null});
    jest.runAllTimers();
    wrapper.update();
    expect(wrapper.find('ToastIndicator')).toHaveLength(1);
    expect(wrapper.find('Message').text()).toBe('Loading');

    wrapper.find('ToastIndicator').simulate('click');
    jest.runAllTimers();
    wrapper.update();
    expect(wrapper.find('ToastIndicator div').first().prop('style').opacity).toBe(0);
  });

  it('hides after 10s', function () {
    addMessage('Duration', '', {append: true, duration: 10000});
    jest.advanceTimersByTime(9000);
    wrapper.update();
    expect(wrapper.find('Indicators')).toHaveLength(1);
    expect(wrapper.find('Indicators').prop('items')).toHaveLength(1);
    expect(wrapper.find('Message').text()).toBe('Duration');

    // Still visible
    jest.advanceTimersByTime(999);
    wrapper.update();
    expect(wrapper.find('Indicators').prop('items')).toHaveLength(1);

    // ToastIndicator still exist because of animations
    // but `items` prop should be empty
    jest.advanceTimersByTime(2);
    wrapper.update();
    expect(wrapper.find('Indicators').prop('items')).toHaveLength(0);

    // Animation is exiting
    expect(wrapper.find('ToastIndicator div').first().prop('style').opacity).toBe(0);
  });
});
