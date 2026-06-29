import {buildHeatmapCellQuery} from 'sentry/views/dashboards/widgetCard/buildHeatmapCellQuery';

describe('buildHeatmapCellQuery', () => {
  it('uses a range filter when the bucket has width', () => {
    expect(buildHeatmapCellQuery(undefined, 10, 20)).toBe('value:>=10 value:<20');
  });

  it('uses a single bound when the bucket is zero-width', () => {
    expect(buildHeatmapCellQuery(undefined, 10, 10)).toBe('value:<=10');
  });

  it('treats an empty base query as no base query', () => {
    expect(buildHeatmapCellQuery('', 10, 20)).toBe('value:>=10 value:<20');
  });

  it('AND-combines a simple base query with the value filter', () => {
    expect(buildHeatmapCellQuery('span.op:db', 10, 20)).toBe(
      '(span.op:db) value:>=10 value:<20'
    );
  });

  it('parenthesizes a base query with top-level OR so the value filter is not captured', () => {
    expect(buildHeatmapCellQuery('url:ABC OR url:XYZ', 10, 20)).toBe(
      '(url:ABC OR url:XYZ) value:>=10 value:<20'
    );
  });
});
