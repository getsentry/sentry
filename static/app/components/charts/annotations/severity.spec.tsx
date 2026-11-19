import {isSevere} from './severity';
import type {AnnotationItem} from './types';

const START = new Date('2026-11-03T12:00:00Z').getTime();

function item(overrides: Partial<AnnotationItem>): AnnotationItem {
  return {
    id: '1',
    kind: 'timeseriesAnnotation',
    start: START,
    title: 'Outage',
    ...overrides,
  };
}

describe('isSevere', () => {
  it('is true for high severity timeseries annotations', () => {
    expect(isSevere(item({severity: 'high'}))).toBe(true);
  });

  it('is false for lower severity timeseries annotations', () => {
    expect(isSevere(item({severity: 'medium'}))).toBe(false);
    expect(isSevere(item({severity: 'low'}))).toBe(false);
  });

  it('is false for releases and flag changes', () => {
    expect(isSevere(item({kind: 'release', severity: 'high'}))).toBe(false);
    expect(isSevere(item({kind: 'flag', severity: 'high'}))).toBe(false);
  });
});
