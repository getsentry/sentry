import {fitTabs} from './fitTabs';

describe('fitTabs', () => {
  it('fits every tab when they and their gaps fit', () => {
    expect(fitTabs([100, 100, 100], 4, 308)).toEqual({visibleCount: 3, triggerOffset: 0});
  });

  it('counts the gaps between tabs', () => {
    expect(fitTabs([100, 100, 100], 4, 307).visibleCount).toBeLessThan(3);
  });

  it('fits tabs a fraction of a pixel wider than the available space', () => {
    // When the page is zoomed, tabs in a container exactly as wide as them can
    // add up to slightly more than the container.
    expect(fitTabs([100.125, 100.125], 0, 200.2).visibleCount).toBe(2);
  });

  it('reserves room for the overflow trigger once tabs overflow', () => {
    // 260 - 48 for the trigger leaves room for two tabs.
    expect(fitTabs([100, 100, 100, 100], 0, 260)).toEqual({
      visibleCount: 2,
      triggerOffset: 200,
    });
  });

  it('places the trigger after the gap following the last visible tab', () => {
    expect(fitTabs([100, 100, 100], 4, 260)).toEqual({
      visibleCount: 2,
      triggerOffset: 208,
    });
  });

  it('keeps the first tab even when it does not fit next to the trigger', () => {
    expect(fitTabs([100, 100], 0, 120)).toEqual({visibleCount: 1, triggerOffset: 72});
  });

  it('never places the trigger outside the available space', () => {
    expect(fitTabs([100, 100], 0, 20)).toEqual({visibleCount: 1, triggerOffset: 0});
  });
});
