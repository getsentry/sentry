import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {parseSearch} from 'sentry/components/searchSyntax/parser';
import {
  extractFilterKeys,
  useAttributeValidation,
  type AttributeValidationSelection,
} from 'sentry/views/explore/hooks/useAttributeValidation';
import {TraceItemDataset} from 'sentry/views/explore/types';

const ORG_SLUG = 'org-slug';
const DEFAULT_SELECTION: AttributeValidationSelection = {
  datetime: {period: '14d', start: null, end: null, utc: false},
  projects: [],
};

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

describe('useAttributeValidation', () => {
  const organization = OrganizationFixture({slug: ORG_SLUG});

  it('returns empty invalidFilterKeys initially', () => {
    const {result} = renderHookWithProviders(
      () => useAttributeValidation(TraceItemDataset.SPANS),
      {organization}
    );

    expect(result.current.invalidFilterKeys).toEqual([]);
  });

  it('does not call the API when query has no filter keys', async () => {
    const mockValidate = MockApiClient.addMockResponse({
      url: `/organizations/${ORG_SLUG}/trace-items/attributes/validate/`,
      method: 'POST',
      body: {attributes: {}},
    });

    const {result} = renderHookWithProviders(
      () => useAttributeValidation(TraceItemDataset.SPANS),
      {organization}
    );

    await act(async () => {
      await result.current.validateQuery('', DEFAULT_SELECTION);
    });

    expect(mockValidate).not.toHaveBeenCalled();
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
      await result.current.validateQuery(
        'span.op:db unknown_key:value',
        DEFAULT_SELECTION
      );
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
      await result.current.validateQuery('span.op:db', DEFAULT_SELECTION);
    });

    await waitFor(() => {
      expect(result.current.invalidFilterKeys).toEqual([]);
    });
  });

  it('skips validation when keys and selection are unchanged', async () => {
    const mockValidate = MockApiClient.addMockResponse({
      url: `/organizations/${ORG_SLUG}/trace-items/attributes/validate/`,
      method: 'POST',
      body: {attributes: {'span.op': {valid: true}}},
    });

    const {result} = renderHookWithProviders(
      () => useAttributeValidation(TraceItemDataset.SPANS),
      {organization}
    );

    await act(async () => {
      await result.current.validateQuery('span.op:db', DEFAULT_SELECTION);
    });

    await act(async () => {
      await result.current.validateQuery('span.op:web', DEFAULT_SELECTION);
    });

    expect(mockValidate).toHaveBeenCalledTimes(1);
  });

  it('re-validates when selection changes', async () => {
    const mockValidate = MockApiClient.addMockResponse({
      url: `/organizations/${ORG_SLUG}/trace-items/attributes/validate/`,
      method: 'POST',
      body: {attributes: {'span.op': {valid: true}}},
    });

    const {result} = renderHookWithProviders(
      () => useAttributeValidation(TraceItemDataset.SPANS),
      {organization}
    );

    await act(async () => {
      await result.current.validateQuery('span.op:db', DEFAULT_SELECTION);
    });

    await act(async () => {
      await result.current.validateQuery('span.op:db', {
        datetime: {period: '7d', start: null, end: null, utc: false},
        projects: [],
      });
    });

    expect(mockValidate).toHaveBeenCalledTimes(2);
  });
});
