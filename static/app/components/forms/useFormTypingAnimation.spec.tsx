import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import {useFormTypingAnimation} from './useFormTypingAnimation';

describe('useFormTypingAnimation', () => {
  function useTestHook(props: {speed?: number}) {
    return useFormTypingAnimation(props);
  }

  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('animates text into the target form field', () => {
    let value = 'initial';
    const setValue = (next: string) => {
      value = next;
    };
    const {result} = renderHook(useTestHook, {
      initialProps: {speed: 80},
    });

    act(() => {
      result.current.triggerFormTypingAnimation({setValue, text: 'Hello'});
    });

    expect(value).toBe('');

    act(() => {
      jest.advanceTimersByTime(48);
    });

    expect(value.length).toBeGreaterThan(0);
    expect(value.length).toBeLessThan('Hello'.length);

    act(() => {
      jest.runAllTimers();
    });

    expect(value).toBe('Hello');
  });

  it('restarts animation when triggered again', () => {
    let value = '';
    const setValue = (next: string) => {
      value = next;
    };
    const {result} = renderHook(useTestHook, {
      initialProps: {speed: 10},
    });

    act(() => {
      result.current.triggerFormTypingAnimation({
        setValue,
        text: 'First generated title',
      });
    });

    act(() => {
      jest.advanceTimersByTime(120);
    });

    act(() => {
      result.current.triggerFormTypingAnimation({
        setValue,
        text: 'New title',
        speed: 120,
      });
    });

    act(() => {
      jest.runAllTimers();
    });

    expect(value).toBe('New title');
  });
});
