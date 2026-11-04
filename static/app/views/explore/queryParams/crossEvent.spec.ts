import {getCrossEvents} from 'sentry/views/explore/queryParams/crossEvent';

describe('getCrossEvents', () => {
  it('returns undefined when the param is missing', () => {
    expect(getCrossEvents(null)).toBeUndefined();
  });

  it('returns undefined when the param is not JSON', () => {
    expect(getCrossEvents('[{"type":')).toBeUndefined();
  });

  it('returns undefined when the JSON is not an array', () => {
    expect(getCrossEvents(JSON.stringify({query: '', type: 'logs'}))).toBeUndefined();
  });

  it('returns undefined when no cross events are valid', () => {
    expect(getCrossEvents(JSON.stringify([{query: '', type: 'errors'}]))).toBeUndefined();
  });

  it('keeps valid cross events when invalid ones are mixed in', () => {
    const raw = JSON.stringify([
      {query: 'a', type: 'logs'},
      {query: 1, type: 'spans'},
      null,
      {
        metric: {name: 'm', type: 'counter', unit: null},
        query: 'b',
        type: 'metrics',
      },
      {metric: {name: 'm'}, query: 'c', type: 'metrics'},
      {metric: {name: 'm', type: 'counter', unit: 1}, query: 'd', type: 'metrics'},
      {query: 'e', type: 1},
    ]);

    const crossEvents = getCrossEvents(raw);

    expect(crossEvents).toEqual([
      {query: 'a', type: 'logs'},
      {metric: {name: 'm', type: 'counter', unit: null}, query: 'b', type: 'metrics'},
    ]);
  });

  it('keeps extra keys when a cross event has them', () => {
    const raw = JSON.stringify([
      {
        extra: true,
        metric: {extra: 1, name: 'm', type: 'gauge'},
        query: '',
        type: 'metrics',
      },
    ]);

    const crossEvents = getCrossEvents(raw);

    expect(crossEvents).toEqual([
      {
        extra: true,
        metric: {extra: 1, name: 'm', type: 'gauge'},
        query: '',
        type: 'metrics',
      },
    ]);
  });
});
