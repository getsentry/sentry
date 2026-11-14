import {act, renderHook} from 'sentry-test/reactTestingLibrary';

import type {Feature} from 'getsentry/components/upsellModal/types';
import {useFeatureRotation} from 'getsentry/components/upsellModal/useFeatureRotation';

function makeFeature(id: string): Feature {
  return {id, name: id, desc: id, image: `${id}.svg`, planFeatures: []};
}

const features = [makeFeature('a'), makeFeature('b'), makeFeature('c')];

const options = {
  features,
  initialFeatureId: null,
  firstDelayMs: 10_000,
  intervalMs: 6_000,
};

describe('useFeatureRotation', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    try {
      act(() => jest.runOnlyPendingTimers());
    } finally {
      jest.useRealTimers();
    }
  });

  it('waits for the first delay, then rotates on the interval and wraps around', () => {
    const {result} = renderHook(useFeatureRotation, {initialProps: options});
    expect(result.current.highlightedFeatureId).toBeNull();

    act(() => jest.advanceTimersByTime(9_999));
    expect(result.current.highlightedFeatureId).toBeNull();

    act(() => jest.advanceTimersByTime(1));
    expect(result.current.highlightedFeatureId).toBe('a');

    act(() => jest.advanceTimersByTime(6_000));
    expect(result.current.highlightedFeatureId).toBe('b');

    act(() => jest.advanceTimersByTime(6_000));
    expect(result.current.highlightedFeatureId).toBe('c');

    act(() => jest.advanceTimersByTime(6_000));
    expect(result.current.highlightedFeatureId).toBe('a');
  });

  it('continues from the initial feature', () => {
    const {result} = renderHook(useFeatureRotation, {
      initialProps: {...options, initialFeatureId: 'b'},
    });
    expect(result.current.highlightedFeatureId).toBe('b');

    act(() => jest.advanceTimersByTime(10_000));
    expect(result.current.highlightedFeatureId).toBe('c');
  });

  it('stops rotating once a feature is selected', () => {
    const {result} = renderHook(useFeatureRotation, {initialProps: options});
    expect(result.current.hasClickedFeature).toBe(false);

    act(() => result.current.selectFeature(features[1]!));
    expect(result.current.highlightedFeatureId).toBe('b');
    expect(result.current.hasClickedFeature).toBe(true);

    act(() => jest.advanceTimersByTime(60_000));
    expect(result.current.highlightedFeatureId).toBe('b');
  });

  it('stops rotating when selected after rotation has started', () => {
    const {result} = renderHook(useFeatureRotation, {initialProps: options});

    act(() => jest.advanceTimersByTime(10_000));
    expect(result.current.highlightedFeatureId).toBe('a');

    act(() => result.current.selectFeature(features[2]!));
    act(() => jest.advanceTimersByTime(60_000));
    expect(result.current.highlightedFeatureId).toBe('c');
  });

  it('deselects when the highlighted feature is selected again', () => {
    const {result} = renderHook(useFeatureRotation, {
      initialProps: {...options, initialFeatureId: 'a'},
    });

    act(() => result.current.selectFeature(features[0]!));
    expect(result.current.highlightedFeatureId).toBeNull();
  });

  it('clears its timers on unmount', () => {
    const {unmount} = renderHook(useFeatureRotation, {initialProps: options});
    unmount();
    expect(jest.getTimerCount()).toBe(0);
  });
});
