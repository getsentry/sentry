import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {parseSearch} from 'sentry/components/searchSyntax/parser';
import {parseQueryKey} from 'sentry/utils/api/apiQueryKey';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {
  extractFilterKeys,
  useAttributeValidation,
  validateAttributesQueryOptions,
} from 'sentry/views/explore/hooks/useAttributeValidation';
import {TraceItemDataset} from 'sentry/views/explore/types';

jest.mock('sentry/components/pageFilters/usePageFilters');

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
    expect(extractFilterKeys(parseSearch(''))).toEqual([]);
  });

  it('returns empty array when there are no filter tokens', () => {
    expect(extractFilterKeys(parseSearch('hello world'))).toEqual([]);
  });

  it('extracts and sorts filter keys', () => {
    expect(extractFilterKeys(parseSearch('zebra:value apple:value'))).toEqual([
      'apple',
      'zebra',
    ]);
  });

  it('deduplicates keys', () => {
    expect(extractFilterKeys(parseSearch('duplicate:value duplicate:other'))).toEqual([
      'duplicate',
    ]);
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

    const {url, options: endpointOptions} = parseQueryKey(options.queryKey);
    expect(url).toBe(VALIDATE_URL);
    expect(endpointOptions?.method).toBe('POST');
    expect(endpointOptions?.data).toEqual({
      itemType: TraceItemDataset.LOGS,
      attributes: ['log.level'],
    });
    expect(endpointOptions?.query?.statsPeriod).toBe('14d');
  });

  it('includes project IDs in query params when provided', () => {
    const options = validateAttributesQueryOptions({
      itemType: TraceItemDataset.SPANS,
      filterKeys: ['span.op'],
      organizationSlug: ORG_SLUG,
      datetime: DEFAULT_DATETIME,
      projects: [2, 3],
    });

    const {options: endpointOptions} = parseQueryKey(options.queryKey);
    expect(endpointOptions?.query?.project).toEqual(['2', '3']);
  });

  it('omits project param when projects is empty', () => {
    const options = validateAttributesQueryOptions({
      itemType: TraceItemDataset.SPANS,
      filterKeys: ['span.op'],
      organizationSlug: ORG_SLUG,
      datetime: DEFAULT_DATETIME,
      projects: [],
    });

    const {options: endpointOptions} = parseQueryKey(options.queryKey);
    expect(endpointOptions?.query?.project).toBeUndefined();
  });

  it('normalizes datetime params correctly', () => {
    const datetime = {period: null, start: '2024-01-01', end: '2024-01-31', utc: true};
    const options = validateAttributesQueryOptions({
      itemType: TraceItemDataset.SPANS,
      filterKeys: ['span.op'],
      organizationSlug: ORG_SLUG,
      datetime,
    });

    const {options: endpointOptions} = parseQueryKey(options.queryKey);
    const normalized = Object.fromEntries(
      Object.entries(normalizeDateTimeParams(datetime)).filter(
        (entry): entry is [string, string | string[]] => entry[1] !== null
      )
    );
    expect(endpointOptions?.query).toMatchObject(normalized);
  });
});

describe('useAttributeValidation', () => {
  const organization = OrganizationFixture({slug: ORG_SLUG});

  beforeEach(() => {
    jest.mocked(usePageFilters).mockReturnValue({
      isReady: true,
      pinnedFilters: new Set(),
      shouldPersist: true,
      selection: {
        datetime: DEFAULT_DATETIME,
        environments: [],
        projects: [],
      },
    });
  });

  it('returns empty invalidFilterKeys initially', () => {
    const {result} = renderHookWithProviders(
      () => useAttributeValidation(TraceItemDataset.SPANS),
      {organization}
    );

    expect(result.current.invalidFilterKeys).toEqual([]);
  });

  it('clears invalidFilterKeys when called with an empty query', async () => {
    const {result} = renderHookWithProviders(
      () => useAttributeValidation(TraceItemDataset.SPANS),
      {organization}
    );

    await act(async () => {
      await result.current.validateQuery('');
    });
    expect(result.current.invalidFilterKeys).toEqual([]);
  });

  it('sets invalidFilterKeys for keys the API reports as invalid', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${ORG_SLUG}/trace-items/attributes/validate/`,
      method: 'POST',
      body: {
        attributes: {
          'span.op': {valid: true},
          unknown_key: {valid: false, error: 'Unknown attribute'},
        },
      },
    });

    const {result} = renderHookWithProviders(
      () => useAttributeValidation(TraceItemDataset.SPANS),
      {organization}
    );

    await act(async () => {
      await result.current.validateQuery('span.op:db unknown_key:value');
    });

    await waitFor(() => {
      expect(result.current.invalidFilterKeys).toEqual(['unknown_key']);
    });
  });

  it('clears invalidFilterKeys when all keys become valid', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${ORG_SLUG}/trace-items/attributes/validate/`,
      method: 'POST',
      body: {attributes: {'span.op': {valid: true}}},
    });

    const {result} = renderHookWithProviders(
      () => useAttributeValidation(TraceItemDataset.SPANS),
      {organization}
    );

    await act(async () => {
      await result.current.validateQuery('span.op:db');
    });

    await waitFor(() => {
      expect(result.current.invalidFilterKeys).toEqual([]);
    });
  });
});
