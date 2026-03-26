import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import type {ParseResult} from 'sentry/components/searchSyntax/parser';
import {Token} from 'sentry/components/searchSyntax/parser';
import {
  extractFilterKeys,
  useAsyncAttributeValidation,
} from 'sentry/views/explore/hooks/useAsyncAttributeValidation';
import {TraceItemDataset} from 'sentry/views/explore/types';

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

describe('useAsyncAttributeValidation', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();

    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState({
      projects: [1],
      environments: [],
      datetime: {
        period: '14d',
        start: null,
        end: null,
        utc: false,
      },
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('returns empty array when filterKeys is empty', () => {
    const {result} = renderHookWithProviders(() =>
      useAsyncAttributeValidation(TraceItemDataset.SPANS, [])
    );

    expect(result.current).toEqual([]);
  });

  it('returns invalid keys from the API response', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/validate/',
      method: 'POST',
      body: {
        attributes: {
          'span.op': {valid: true, type: 'string'},
          'bad.key': {valid: false, error: 'Attribute not found'},
        },
      },
    });

    const {result} = renderHookWithProviders(() =>
      useAsyncAttributeValidation(TraceItemDataset.SPANS, ['span.op', 'bad.key'])
    );

    await waitFor(() => {
      expect(result.current).toEqual(['bad.key']);
    });
  });

  it('returns empty array when all keys are valid', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/validate/',
      method: 'POST',
      body: {
        attributes: {
          'span.op': {valid: true, type: 'string'},
          'span.duration': {valid: true, type: 'number'},
        },
      },
    });

    const {result} = renderHookWithProviders(() =>
      useAsyncAttributeValidation(TraceItemDataset.SPANS, ['span.op', 'span.duration'])
    );

    await waitFor(() => {
      expect(result.current).toEqual([]);
    });
  });

  it('returns multiple invalid keys', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/validate/',
      method: 'POST',
      body: {
        attributes: {
          'bad.one': {valid: false, error: 'Not found'},
          'bad.two': {valid: false, error: 'Not found'},
          'good.key': {valid: true, type: 'string'},
        },
      },
    });

    const {result} = renderHookWithProviders(() =>
      useAsyncAttributeValidation(TraceItemDataset.SPANS, [
        'bad.one',
        'bad.two',
        'good.key',
      ])
    );

    await waitFor(() => {
      expect(result.current).toEqual(['bad.one', 'bad.two']);
    });
  });

  it('sends correct request parameters', async () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/validate/',
      method: 'POST',
      body: {
        attributes: {
          'log.level': {valid: true, type: 'string'},
        },
      },
    });

    renderHookWithProviders(() =>
      useAsyncAttributeValidation(TraceItemDataset.LOGS, ['log.level'])
    );

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          method: 'POST',
          data: {
            itemType: TraceItemDataset.LOGS,
            attributes: ['log.level'],
          },
          query: expect.objectContaining({
            project: ['1'],
            statsPeriod: '14d',
          }),
        })
      );
    });
  });

  it('uses provided projects instead of page filters', async () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/validate/',
      method: 'POST',
      body: {
        attributes: {
          'span.op': {valid: true, type: 'string'},
        },
      },
    });

    renderHookWithProviders(() =>
      useAsyncAttributeValidation(TraceItemDataset.SPANS, ['span.op'], [2, 3])
    );

    await waitFor(() => {
      expect(mockRequest).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          query: expect.objectContaining({
            project: ['2', '3'],
          }),
        })
      );
    });
  });

  it('does not make API call when filterKeys is empty', () => {
    const mockRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/validate/',
      method: 'POST',
      body: {attributes: {}},
    });

    renderHookWithProviders(() =>
      useAsyncAttributeValidation(TraceItemDataset.SPANS, [])
    );

    expect(mockRequest).not.toHaveBeenCalled();
  });
});
