import {renderHook} from 'sentry-test/reactTestingLibrary';

import {useFormTypingAnimation} from './useFormTypingAnimation';

describe('useFormTypingAnimation', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  const setValue = jest.fn<(value: string) => void>();
  const latest = () => setValue.mock.lastCall?.[0];

  beforeEach(() => setValue.mockClear());

  it('animates text into the target form field', () => {
    const {result} = renderHook(useFormTypingAnimation, {initialProps: {speed: 80}});

    result.current.triggerFormTypingAnimation({setValue, text: 'Hello'});
    expect(latest()).toBe('');

    jest.advanceTimersByTime(48);
    const partial = latest() ?? '';
    expect(partial.length).toBeGreaterThan(0); // started typing...
    expect('Hello'.startsWith(partial)).toBe(true); // ...a prefix, not yet complete
    expect(partial).not.toBe('Hello');

    jest.runAllTimers();
    expect(latest()).toBe('Hello');
  });

  it('restarts animation when triggered again', () => {
    const {result} = renderHook(useFormTypingAnimation, {initialProps: {speed: 10}});

    result.current.triggerFormTypingAnimation({setValue, text: 'First title'});
    jest.advanceTimersByTime(120);

    result.current.triggerFormTypingAnimation({setValue, text: 'New title', speed: 120});
    jest.runAllTimers();

    expect(latest()).toBe('New title');
  });
});
