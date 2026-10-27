import {DiscoverDatasets} from 'sentry/utils/discover/types';

import {datasetNoun, droppedAndFilteredLabel, droppedDataLabel} from './outcomes';

describe('droppedDataLabel', () => {
  it('names the telemetry type', () => {
    expect(droppedDataLabel(DiscoverDatasets.SPANS)).toBe('Dropped Spans');
    expect(droppedDataLabel(DiscoverDatasets.OURLOGS)).toBe('Dropped Logs');
    expect(droppedDataLabel(DiscoverDatasets.TRACEMETRICS)).toBe('Dropped Metrics');
    expect(droppedDataLabel(DiscoverDatasets.ERRORS)).toBe('Dropped Errors');
  });

  it('falls back to events for other datasets', () => {
    expect(droppedDataLabel(DiscoverDatasets.TRANSACTIONS)).toBe('Dropped Events');
  });
});

describe('droppedAndFilteredLabel', () => {
  it('names the telemetry type', () => {
    expect(droppedAndFilteredLabel(DiscoverDatasets.SPANS)).toBe(
      'Dropped and Filtered Spans'
    );
    expect(droppedAndFilteredLabel(DiscoverDatasets.OURLOGS)).toBe(
      'Dropped and Filtered Logs'
    );
    expect(droppedAndFilteredLabel(DiscoverDatasets.TRACEMETRICS)).toBe(
      'Dropped and Filtered Metrics'
    );
    expect(droppedAndFilteredLabel(DiscoverDatasets.ERRORS)).toBe(
      'Dropped and Filtered Errors'
    );
  });

  it('falls back to events for other datasets', () => {
    expect(droppedAndFilteredLabel(DiscoverDatasets.TRANSACTIONS)).toBe(
      'Dropped and Filtered Events'
    );
  });
});

describe('datasetNoun', () => {
  it('pluralizes the telemetry type by count', () => {
    expect(datasetNoun(DiscoverDatasets.SPANS, 1)).toBe('span');
    expect(datasetNoun(DiscoverDatasets.SPANS, 0)).toBe('spans');
    expect(datasetNoun(DiscoverDatasets.OURLOGS, 2)).toBe('logs');
    expect(datasetNoun(DiscoverDatasets.TRACEMETRICS, 2)).toBe('metrics');
    expect(datasetNoun(DiscoverDatasets.ERRORS, 1)).toBe('error');
  });

  it('falls back to events for other datasets', () => {
    expect(datasetNoun(DiscoverDatasets.TRANSACTIONS, 2)).toBe('events');
  });
});
