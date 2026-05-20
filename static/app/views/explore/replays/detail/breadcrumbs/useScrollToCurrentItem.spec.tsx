import type {Virtualizer} from '@tanstack/react-virtual';
import {ReplayClickFrameFixture} from 'sentry-fixture/replay/replayBreadcrumbFrameData';
import {ReplayRecordFixture} from 'sentry-fixture/replayRecord';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {hydrateBreadcrumbs} from 'sentry/utils/replays/hydrateBreadcrumbs';

import {useScrollToCurrentItem} from './useScrollToCurrentItem';

const frames = hydrateBreadcrumbs(
  ReplayRecordFixture({started_at: new Date('2024-01-01T00:00:00.000Z')}),
  [
    ReplayClickFrameFixture({timestamp: new Date('2024-01-01T00:00:01.000Z')}), // offsetMs ~1000
    ReplayClickFrameFixture({timestamp: new Date('2024-01-01T00:00:02.000Z')}), // offsetMs ~2000
    ReplayClickFrameFixture({timestamp: new Date('2024-01-01T00:00:03.000Z')}), // offsetMs ~3000
  ]
);

function makeVirtualizer() {
  const scrollToIndex = jest.fn();
  return {
    scrollToIndex,
    virtualizer: {scrollToIndex} as unknown as Virtualizer<HTMLDivElement, Element>,
  };
}

describe('useScrollToCurrentItem', () => {
  it('scrolls to the current frame when autoScrollEnabled is true', () => {
    const {scrollToIndex, virtualizer} = makeVirtualizer();

    renderHookWithProviders(() =>
      useScrollToCurrentItem({
        autoScrollEnabled: true,
        currentTime: 1500,
        frames,
        virtualizer,
      })
    );

    // frame at ~1000ms (index 0) is the last frame before currentTime=1500
    expect(scrollToIndex).toHaveBeenCalledWith(0, {align: 'center', behavior: 'smooth'});
  });

  it('scrolls to the correct index as currentTime advances', () => {
    const {scrollToIndex, virtualizer} = makeVirtualizer();

    renderHookWithProviders(() =>
      useScrollToCurrentItem({
        autoScrollEnabled: true,
        currentTime: 2500,
        frames,
        virtualizer,
      })
    );

    // frame at ~2000ms (index 1) is the last frame before currentTime=2500
    expect(scrollToIndex).toHaveBeenCalledWith(1, {align: 'center', behavior: 'smooth'});
  });

  it('does not scroll when autoScrollEnabled is false', () => {
    const {scrollToIndex, virtualizer} = makeVirtualizer();

    renderHookWithProviders(() =>
      useScrollToCurrentItem({
        autoScrollEnabled: false,
        currentTime: 1500,
        frames,
        virtualizer,
      })
    );

    expect(scrollToIndex).not.toHaveBeenCalled();
  });

  it('does not scroll when virtualizer is null', () => {
    const {scrollToIndex} = makeVirtualizer();

    renderHookWithProviders(() =>
      useScrollToCurrentItem({
        autoScrollEnabled: true,
        currentTime: 1500,
        frames,
        virtualizer: null,
      })
    );

    expect(scrollToIndex).not.toHaveBeenCalled();
  });

  it('does not scroll when frames is undefined', () => {
    const {scrollToIndex, virtualizer} = makeVirtualizer();

    renderHookWithProviders(() =>
      useScrollToCurrentItem({
        autoScrollEnabled: true,
        currentTime: 1500,
        frames: undefined,
        virtualizer,
      })
    );

    expect(scrollToIndex).not.toHaveBeenCalled();
  });

  it('does not scroll when currentTime is before all frames', () => {
    const {scrollToIndex, virtualizer} = makeVirtualizer();

    renderHookWithProviders(() =>
      useScrollToCurrentItem({
        autoScrollEnabled: true,
        currentTime: 0,
        frames,
        virtualizer,
      })
    );

    expect(scrollToIndex).not.toHaveBeenCalled();
  });

  it('scrolls when autoScrollEnabled switches from false to true', () => {
    const {scrollToIndex, virtualizer} = makeVirtualizer();

    const {rerender} = renderHookWithProviders(
      ({enabled}: {enabled: boolean}) =>
        useScrollToCurrentItem({
          autoScrollEnabled: enabled,
          currentTime: 1500,
          frames,
          virtualizer,
        }),
      {initialProps: {enabled: false}}
    );

    expect(scrollToIndex).not.toHaveBeenCalled();

    rerender({enabled: true});

    expect(scrollToIndex).toHaveBeenCalledWith(0, {align: 'center', behavior: 'smooth'});
  });

  it('scrolls to the new frame when currentTime advances to the next frame', () => {
    const {scrollToIndex, virtualizer} = makeVirtualizer();

    const {rerender} = renderHookWithProviders(
      ({currentTime}: {currentTime: number}) =>
        useScrollToCurrentItem({
          autoScrollEnabled: true,
          currentTime,
          frames,
          virtualizer,
        }),
      {initialProps: {currentTime: 1500}}
    );

    expect(scrollToIndex).toHaveBeenLastCalledWith(0, {
      align: 'center',
      behavior: 'smooth',
    });

    rerender({currentTime: 2500});

    expect(scrollToIndex).toHaveBeenLastCalledWith(1, {
      align: 'center',
      behavior: 'smooth',
    });
  });
});
