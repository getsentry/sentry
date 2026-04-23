import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {useRotatingMessage} from 'sentry/views/replays/detail/ai/useRotatingMessage';

describe('useRotatingMessage', () => {
  const messages = ['First', 'Second', 'Third', 'Fourth'];

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

  it('advances to a different message after the delay', () => {
    const {result} = renderHook(() => useRotatingMessage(messages));
    const first = result.current;

    act(() => {
      jest.advanceTimersByTime(5000);
    });

    expect(messages).toContain(result.current);
    expect(result.current).not.toBe(first);
  });

  it('never shows the same message twice in a row', () => {
    const {result} = renderHook(() => useRotatingMessage(messages));

    for (let i = 0; i < 10; i++) {
      const prev = result.current;
      act(() => jest.advanceTimersByTime(5000));
      expect(result.current).not.toBe(prev);
    }
  });
});
