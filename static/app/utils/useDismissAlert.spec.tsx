import {reactHooks} from 'sentry-test/reactTestingLibrary';

import localStorage from 'sentry/utils/localStorage';
import useDismissAlert from 'sentry/utils/useDismissAlert';

jest.mock('sentry/utils/localStorage');
jest.useFakeTimers();

const mockSetItem = jest.mocked(localStorage.setItem);
const mockGetItem = jest.mocked(localStorage.getItem);

const key = 'test_123';
const now = new Date('2020-01-01');

describe('useDismissAlert', () => {
  beforeEach(() => {
    jest.setSystemTime(now);

    mockSetItem.mockReset();
    mockGetItem.mockReset();
  });

  it('should return a stable ref for the dismiss() function', () => {
    const {result, rerender} = reactHooks.renderHook(useDismissAlert, {
      initialProps: {key},
    });

    const initialRef = result.current.dismiss;

    rerender();

    expect(result.current.dismiss).toEqual(initialRef);
  });

  it('should not be dismissed if there is no value in localstorage', () => {
    mockGetItem.mockReturnValue(null);

    const hook = reactHooks.renderHook(useDismissAlert, {
      initialProps: {key},
    });
    const {result} = hook;

    expect(result.current.isDismissed).toBeFalsy();
  });

  it('should be dismissed if there is any value in localstorage and no expiration', () => {
    mockGetItem.mockReturnValue(JSON.stringify('some value'));

    const {result} = reactHooks.renderHook(useDismissAlert, {
      initialProps: {key},
    });

    expect(result.current.isDismissed).toBeTruthy();
  });

  it('should set the current timestamp into localstorage when an alert is dismissed', () => {
    const {result} = reactHooks.renderHook(useDismissAlert, {
      initialProps: {key},
    });

    reactHooks.act(() => {
      result.current.dismiss();
      jest.runAllTicks();
    });

    expect(mockSetItem).toHaveBeenCalledWith(
      key,
      JSON.stringify(now.getTime().toString())
    );
  });

  it('should be dismissed if the timestamp in localStorage is older than the expiration', () => {
    const today = new Date('2020-01-01');
    jest.setSystemTime(today);

    // Dismissed on christmas
    const christmas = new Date('2019-12-25').getTime();
    mockGetItem.mockReturnValue(JSON.stringify(christmas));

    // Expires after 2 days
    const {result} = reactHooks.renderHook(useDismissAlert, {
      initialProps: {key, expirationDays: 2},
    });

    // Dismissal has expired
    expect(result.current.isDismissed).toBeFalsy();
  });

  it('should not be dismissed if the timestamp in localstorage is more recent than the expiration', () => {
    // Dismissed on christmas
    const christmas = new Date('2019-12-25').getTime();
    mockGetItem.mockReturnValue(JSON.stringify(christmas));

    // Expires after 30 days
    const {result} = reactHooks.renderHook(useDismissAlert, {
      initialProps: {key, expirationDays: 30},
    });

    // Not expired, dismissal is still active
    expect(result.current.isDismissed).toBeTruthy();
  });

  it('should not be dismissed if the value in localstorage is not a number/timestamp', () => {
    mockGetItem.mockReturnValue(JSON.stringify('foobar'));

    const {result} = reactHooks.renderHook(useDismissAlert, {
      initialProps: {key, expirationDays: 30},
    });

    expect(result.current.isDismissed).toBeFalsy();
  });
});
