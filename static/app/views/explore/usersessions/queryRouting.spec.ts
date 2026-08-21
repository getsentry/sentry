import type {KnownKeysByDataset} from './queryRouting';
import {datasetsForQuery, requiredKeys, unrecognizedKeys} from './queryRouting';

const KNOWN_KEYS: KnownKeysByDataset = {
  logs: new Set(['message', 'severity', 'user.id']),
  metrics: new Set(['metric.name', 'unit']),
  traces: new Set(['span.op', 'span.description', 'span.duration', 'user.id']),
  errors: new Set(['level', 'user.id']),
};

describe('requiredKeys', () => {
  it('reads the attribute out of a has filter rather than the key', () => {
    expect(requiredKeys('has:span.op')).toEqual(['span.op']);
    expect(requiredKeys('!has:span.op')).toEqual(['span.op']);
  });

  it('strips negation and unwraps aggregates', () => {
    expect(requiredKeys('!span.op:pageload')).toEqual(['span.op']);
    expect(requiredKeys('count(span.duration):>5')).toEqual(['span.duration']);
  });

  it('ignores free text and argless aggregates', () => {
    expect(requiredKeys('some free text')).toEqual([]);
    expect(requiredKeys('count():>5')).toEqual([]);
  });
});

describe('datasetsForQuery', () => {
  it('queries every dataset when there is no filter', () => {
    expect(datasetsForQuery('', KNOWN_KEYS)).toEqual([
      'logs',
      'metrics',
      'traces',
      'errors',
    ]);
    expect(datasetsForQuery('   ', KNOWN_KEYS)).toEqual([
      'logs',
      'metrics',
      'traces',
      'errors',
    ]);
  });

  it('queries every dataset for free text', () => {
    expect(datasetsForQuery('checkout', KNOWN_KEYS)).toEqual([
      'logs',
      'metrics',
      'traces',
      'errors',
    ]);
  });

  it('routes a dataset-specific key to that dataset alone', () => {
    expect(datasetsForQuery('span.op:"pageload"', KNOWN_KEYS)).toEqual(['traces']);
    expect(datasetsForQuery('has:span.op', KNOWN_KEYS)).toEqual(['traces']);
    expect(datasetsForQuery('!span.op:pageload', KNOWN_KEYS)).toEqual(['traces']);
    expect(datasetsForQuery('severity:error', KNOWN_KEYS)).toEqual(['logs']);
  });

  it('routes a shared key to every dataset that knows it', () => {
    expect(datasetsForQuery('user.id:123', KNOWN_KEYS)).toEqual([
      'logs',
      'traces',
      'errors',
    ]);
  });

  it('requires a dataset to know every key in the query', () => {
    // Only traces knows both.
    expect(datasetsForQuery('user.id:123 span.op:pageload', KNOWN_KEYS)).toEqual([
      'traces',
    ]);
    // No single dataset knows both, so no telemetry item can match.
    expect(datasetsForQuery('span.op:pageload severity:error', KNOWN_KEYS)).toEqual([]);
  });

  it('treats keys that are not attributes as known everywhere', () => {
    expect(datasetsForQuery('environment:prod session.id:abc', KNOWN_KEYS)).toEqual([
      'logs',
      'metrics',
      'traces',
      'errors',
    ]);
  });

  it('returns nothing when no dataset knows the key', () => {
    expect(datasetsForQuery('nonsense.key:1', KNOWN_KEYS)).toEqual([]);
  });
});

describe('unrecognizedKeys', () => {
  it('names only the keys no dataset knows', () => {
    expect(unrecognizedKeys('nonsense.key:1 span.op:pageload', KNOWN_KEYS)).toEqual([
      'nonsense.key',
    ]);
    expect(unrecognizedKeys('span.op:pageload severity:error', KNOWN_KEYS)).toEqual([]);
    expect(unrecognizedKeys('', KNOWN_KEYS)).toEqual([]);
  });
});
