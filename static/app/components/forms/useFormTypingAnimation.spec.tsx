import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import FormModel from 'sentry/components/forms/model';

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
    const formModel = new FormModel();
    const {result} = renderHook(useTestHook, {
      initialProps: {speed: 80},
    });

    act(() => {
      result.current.triggerFormTypingAnimation({
        formModel,
        fieldName: 'name',
        text: 'Hello',
      });
    });

    expect(formModel.getValue('name')).toBe('');

    act(() => {
      jest.advanceTimersByTime(48);
    });

    const intermediateValue = formModel.getValue<string>('name') ?? '';
    expect(intermediateValue.length).toBeGreaterThan(0);
    expect(intermediateValue.length).toBeLessThan('Hello'.length);

    act(() => {
      jest.runAllTimers();
    });

    expect(formModel.getValue('name')).toBe('Hello');
  });

  it('restarts animation when triggered again', () => {
    const formModel = new FormModel();
    const {result} = renderHook(useTestHook, {
      initialProps: {speed: 10},
    });

    act(() => {
      result.current.triggerFormTypingAnimation({
        formModel,
        fieldName: 'name',
        text: 'First generated title',
      });
    });

    act(() => {
      jest.advanceTimersByTime(120);
    });

    act(() => {
      result.current.triggerFormTypingAnimation({
        formModel,
        fieldName: 'name',
        text: 'New title',
        speed: 120,
      });
    });

    act(() => {
      jest.runAllTimers();
    });

    expect(formModel.getValue('name')).toBe('New title');
  });
});
