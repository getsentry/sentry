import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import type {ParseResult} from 'sentry/components/searchSyntax/parser';
import {Token} from 'sentry/components/searchSyntax/parser';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {
  extractFilterKeys,
  validateAttributesQueryOptions,
} from 'sentry/views/explore/utils/attributeValidation';

const ORG_SLUG = 'org-slug';
const VALIDATE_URL = getApiUrl(
  '/organizations/$organizationIdOrSlug/trace-items/attributes/validate/',
  {path: {organizationIdOrSlug: ORG_SLUG}}
);
const DEFAULT_DATETIME = {period: '14d', start: null, end: null, utc: false};

describe('extractFilterKeys', () => {
  it('returns empty array for null parsedQuery', () => {
    expect(extractFilterKeys(null)).toEqual([]);
  });

  it('returns empty array for empty parsedQuery', () => {
    expect(extractFilterKeys([] as unknown as ParseResult)).toEqual([]);
  });

  it('returns empty array when there are no filter tokens', () => {
    const parsedQuery = [
      {type: Token.FREE_TEXT, text: 'hello'},
    ] as unknown as ParseResult;

    expect(extractFilterKeys(parsedQuery)).toEqual([]);
  });

  it('extracts and sorts filter keys', () => {
    const parsedQuery = [
      {
        type: Token.FILTER,
        key: {type: Token.KEY_SIMPLE, value: 'zebra'},
      },
      {
        type: Token.FILTER,
        key: {type: Token.KEY_SIMPLE, value: 'apple'},
      },
    ] as unknown as ParseResult;

    expect(extractFilterKeys(parsedQuery)).toEqual(['apple', 'zebra']);
  });

  it('deduplicates keys', () => {
    const parsedQuery = [
      {
        type: Token.FILTER,
        key: {type: Token.KEY_SIMPLE, value: 'duplicate'},
      },
      {
        type: Token.FILTER,
        key: {type: Token.KEY_SIMPLE, value: 'duplicate'},
      },
    ] as unknown as ParseResult;

    expect(extractFilterKeys(parsedQuery)).toEqual(['duplicate']);
  });

  it('returns stable reference for empty results', () => {
    const result1 = extractFilterKeys(null);
    const result2 = extractFilterKeys(null);
    expect(result1).toBe(result2);
  });
});

describe('validateAttributesQueryOptions', () => {
  it('is disabled when filterKeys is empty', () => {
    const options = validateAttributesQueryOptions({
      itemType: TraceItemDataset.SPANS,
      filterKeys: [],
      organizationSlug: ORG_SLUG,
      datetime: DEFAULT_DATETIME,
    });

    expect(options.enabled).toBe(false);
  });

  it('is enabled when filterKeys is non-empty', () => {
    const options = validateAttributesQueryOptions({
      itemType: TraceItemDataset.SPANS,
      filterKeys: ['span.op'],
      organizationSlug: ORG_SLUG,
      datetime: DEFAULT_DATETIME,
    });

    expect(options.enabled).toBe(true);
  });

  it('builds correct query key with POST body and datetime params', () => {
    const options = validateAttributesQueryOptions({
      itemType: TraceItemDataset.LOGS,
      filterKeys: ['log.level'],
      organizationSlug: ORG_SLUG,
      datetime: DEFAULT_DATETIME,
    });

    const [url, queryKeyOptions] = options.queryKey as [string, Record<string, unknown>];
    expect(url).toBe(VALIDATE_URL);
    expect(queryKeyOptions.method).toBe('POST');
    expect(queryKeyOptions.data).toEqual({
      itemType: TraceItemDataset.LOGS,
      attributes: ['log.level'],
    });
    expect((queryKeyOptions.query as Record<string, unknown>).statsPeriod).toBe('14d');
  });

  it('includes project IDs in query params when provided', () => {
    const options = validateAttributesQueryOptions({
      itemType: TraceItemDataset.SPANS,
      filterKeys: ['span.op'],
      organizationSlug: ORG_SLUG,
      datetime: DEFAULT_DATETIME,
      projects: [2, 3],
    });

    const [, queryKeyOptions] = options.queryKey as [string, Record<string, unknown>];
    expect((queryKeyOptions.query as Record<string, unknown>).project).toEqual([
      '2',
      '3',
    ]);
  });

  it('omits project param when projects is empty', () => {
    const options = validateAttributesQueryOptions({
      itemType: TraceItemDataset.SPANS,
      filterKeys: ['span.op'],
      organizationSlug: ORG_SLUG,
      datetime: DEFAULT_DATETIME,
      projects: [],
    });

    const [, queryKeyOptions] = options.queryKey as [string, Record<string, unknown>];
    expect((queryKeyOptions.query as Record<string, unknown>).project).toBeUndefined();
  });

  it('normalizes datetime params correctly', () => {
    const datetime = {period: null, start: '2024-01-01', end: '2024-01-31', utc: true};
    const options = validateAttributesQueryOptions({
      itemType: TraceItemDataset.SPANS,
      filterKeys: ['span.op'],
      organizationSlug: ORG_SLUG,
      datetime,
    });

    const [, queryKeyOptions] = options.queryKey as [string, Record<string, unknown>];
    const normalized = Object.fromEntries(
      Object.entries(normalizeDateTimeParams(datetime)).filter(
        (entry): entry is [string, string | string[]] => entry[1] !== null
      )
    );
    expect(queryKeyOptions.query).toMatchObject(normalized);
  });
});
