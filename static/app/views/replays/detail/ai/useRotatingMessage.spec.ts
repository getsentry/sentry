import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {useRotatingMessage} from 'sentry/views/replays/detail/ai/useRotatingMessage';

describe('useRotatingMessage', () => {
  const messages = ['First', 'Second', 'Third', 'Fallback'];

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it('starts with a message from the list', () => {
    const {result} = renderHook(() => useRotatingMessage(messages));
    expect(messages).toContain(result.current);
  });

  it('advances to a different message after 1500ms', () => {
    const {result} = renderHook(() => useRotatingMessage(messages));
    const first = result.current;

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    expect(messages).toContain(result.current);
    expect(result.current).not.toBe(first);
  });

  it('always ends on the fallback (last) message', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const {result} = renderHook(() => useRotatingMessage(messages));

    act(() => jest.advanceTimersByTime(1500));
    act(() => jest.advanceTimersByTime(3000));
    act(() => jest.advanceTimersByTime(3000));
    expect(result.current).toBe('Fallback');
  });

  it('stops rotating once the fallback is reached', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const {result} = renderHook(() => useRotatingMessage(messages));

    act(() => jest.advanceTimersByTime(1500));
    act(() => jest.advanceTimersByTime(3000));
    act(() => jest.advanceTimersByTime(3000));
    expect(result.current).toBe('Fallback');

    act(() => jest.advanceTimersByTime(10000));
    expect(result.current).toBe('Fallback');
  });

  it('force-jumps to fallback after 30s absolute timeout', () => {
    jest.spyOn(Math, 'random').mockReturnValue(1); // max delay: 5000ms

    const {result} = renderHook(() => useRotatingMessage(messages));

    act(() => {
      jest.advanceTimersByTime(30000);
    });
    expect(result.current).toBe('Fallback');
  });
});
