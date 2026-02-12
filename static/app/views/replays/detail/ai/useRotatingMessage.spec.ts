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

  it('starts with the first message', () => {
    const {result} = renderHook(() => useRotatingMessage(messages));
    expect(result.current).toBe('First');
  });

  it('advances to second message after 1500ms', () => {
    const {result} = renderHook(() => useRotatingMessage(messages));

    act(() => {
      jest.advanceTimersByTime(1500);
    });

    expect(result.current).toBe('Second');
  });

  it('advances through subsequent messages at 3-5s intervals', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0); // min delay: 3000ms

    const {result} = renderHook(() => useRotatingMessage(messages));

    // First -> Second (1500ms)
    act(() => {
      jest.advanceTimersByTime(1500);
    });
    expect(result.current).toBe('Second');

    // Second -> Third (3000ms with random=0)
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(result.current).toBe('Third');

    // Third -> Fallback (3000ms with random=0)
    act(() => {
      jest.advanceTimersByTime(3000);
    });
    expect(result.current).toBe('Fallback');
  });

  it('stops at the last (fallback) message', () => {
    jest.spyOn(Math, 'random').mockReturnValue(0);

    const {result} = renderHook(() => useRotatingMessage(messages));

    // Advance through all messages step by step (each timer schedules the next)
    act(() => jest.advanceTimersByTime(1500));
    act(() => jest.advanceTimersByTime(3000));
    act(() => jest.advanceTimersByTime(3000));
    expect(result.current).toBe('Fallback');

    // Further time should not change the message
    act(() => jest.advanceTimersByTime(10000));
    expect(result.current).toBe('Fallback');
  });

  it('force-jumps to fallback after 30s absolute timeout', () => {
    jest.spyOn(Math, 'random').mockReturnValue(1); // max delay: 5000ms

    const {result} = renderHook(() => useRotatingMessage(messages));

    // At 30s, should jump to last message regardless of position
    act(() => {
      jest.advanceTimersByTime(30000);
    });
    expect(result.current).toBe('Fallback');
  });
});
