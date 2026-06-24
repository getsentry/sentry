import {createHeatMapColorScale} from 'sentry/views/dashboards/widgets/heatMapWidget/utils/heatMapColorScale';

describe('createHeatMapColorScale', () => {
  it('maps non-positive values and nulls to position 0', () => {
    const scale = createHeatMapColorScale([1, 2, 3]);

    expect(scale.toColorPosition(0)).toBe(0);
    expect(scale.toColorPosition(-5)).toBe(0);
  });

  it('returns 0 for everything when there is no populated data', () => {
    const scale = createHeatMapColorScale([null, 0, null]);

    expect(scale.toColorPosition(0)).toBe(0);
    expect(scale.toColorPosition(100)).toBe(0);
  });

  it('places the only populated cell at the top of the palette', () => {
    const scale = createHeatMapColorScale([42]);

    expect(scale.toColorPosition(42)).toBe(1);
  });

  it('equalizes by rank rather than magnitude', () => {
    // Four populated cells: 1, 2, 1_000_000, 18_000_000. The two large values —
    // which collapsed together under log scaling — land at distinct positions.
    const scale = createHeatMapColorScale([1, 2, 1_000_000, 18_000_000]);

    expect(scale.toColorPosition(1)).toBe(0.25);
    expect(scale.toColorPosition(2)).toBe(0.5);
    expect(scale.toColorPosition(1_000_000)).toBe(0.75);
    expect(scale.toColorPosition(18_000_000)).toBe(1);
  });

  it('is monotonically non-decreasing', () => {
    const scale = createHeatMapColorScale([5, 1, 3, 9, 7]);

    let previous = -Infinity;
    for (const z of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
      const position = scale.toColorPosition(z);
      expect(position).toBeGreaterThanOrEqual(previous);
      previous = position;
    }
  });

  it('gives tied values the same position (top of their rank group)', () => {
    // Three of five values equal 5; all should share position 4/5.
    const scale = createHeatMapColorScale([1, 5, 5, 5, 9]);

    expect(scale.toColorPosition(5)).toBe(0.8);
  });

  it('maps all-equal data to the top position', () => {
    const scale = createHeatMapColorScale([7, 7, 7, 7]);

    expect(scale.toColorPosition(7)).toBe(1);
  });

  it('ignores nulls and non-positive values when equalizing', () => {
    // Only 10 and 20 are populated, so they split the palette in half.
    const scale = createHeatMapColorScale([null, 0, 10, 20, null, -3]);

    expect(scale.toColorPosition(10)).toBe(0.5);
    expect(scale.toColorPosition(20)).toBe(1);
  });

  it('keeps the lowest populated value opaque (position > 0)', () => {
    const scale = createHeatMapColorScale([10, 20, 30, 40]);

    expect(scale.toColorPosition(10)).toBeGreaterThan(0);
  });
});
