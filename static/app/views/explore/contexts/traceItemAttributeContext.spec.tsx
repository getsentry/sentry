import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/components/pageFilters/store';
import {
  extractBaseKey,
  shouldRemoveAttributeKey,
  useTraceItemAttributes,
} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {TraceItemDataset} from 'sentry/views/explore/types';

describe('extractBaseKey', () => {
  it('returns plain key as-is', () => {
    expect(extractBaseKey('is_transaction')).toBe('is_transaction');
  });

  it('extracts base key from tags[key,boolean] format', () => {
    expect(extractBaseKey('tags[is_transaction,boolean]')).toBe('is_transaction');
  });

  it('extracts base key from tags[key,number] format', () => {
    expect(extractBaseKey('tags[is_transaction,number]')).toBe('is_transaction');
  });

  it('extracts base key from tags[key,string] format', () => {
    expect(extractBaseKey('tags[my_tag,string]')).toBe('my_tag');
  });

  it('returns key with dots as-is', () => {
    expect(extractBaseKey('span.duration')).toBe('span.duration');
  });
});

describe('shouldRemoveNumberKey', () => {
  it('returns true when plain number key has a boolean counterpart', () => {
    const booleanBaseKeys = new Set(['is_transaction']);
    expect(shouldRemoveAttributeKey('is_transaction', booleanBaseKeys)).toBe(true);
  });

  it('returns true when tags[key,number] has a boolean counterpart', () => {
    const booleanBaseKeys = new Set(['is_transaction']);
    expect(shouldRemoveAttributeKey('tags[is_transaction,number]', booleanBaseKeys)).toBe(
      true
    );
  });

  it('returns false when number key has no boolean counterpart', () => {
    const booleanBaseKeys = new Set(['is_transaction']);
    expect(shouldRemoveAttributeKey('span.duration', booleanBaseKeys)).toBe(false);
  });

  it('returns false for empty boolean set', () => {
    const booleanBaseKeys = new Set<string>();
    expect(shouldRemoveAttributeKey('is_transaction', booleanBaseKeys)).toBe(false);
  });
});

function addAttributeMock(
  attributeType: string,
  body: Array<{key: string; name: string; secondaryAliases?: string[]}>
) {
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/trace-items/attributes/',
    body,
    match: [
      (_url, options) => {
        const query = options?.query || {};
        return query.attributeType === attributeType;
      },
    ],
  });
}

describe('useTraceItemAttributes number filtering', () => {
  beforeEach(() => {
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

  it('does not filter number attributes when flag is off', async () => {
    const organization = OrganizationFixture({features: []});
    addAttributeMock('number', [{key: 'is_transaction', name: 'is_transaction'}]);
    addAttributeMock('string', []);
    addAttributeMock('boolean', []);

    const {result} = renderHookWithProviders(
      () =>
        useTraceItemAttributes(
          {
            traceItemType: TraceItemDataset.SPANS,
            enabled: true,
          },
          'number'
        ),
      {organization}
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    // is_transaction should still be present as a number attribute
    expect('is_transaction' in result.current.attributes).toBe(true);
  });

  it('filters out number attributes that overlap with boolean attributes when flag is on', async () => {
    const organization = OrganizationFixture({
      features: ['search-query-builder-explicit-boolean-filters'],
    });

    addAttributeMock('number', [
      {key: 'is_transaction', name: 'is_transaction'},
      {key: 'custom_metric', name: 'custom_metric'},
    ]);
    addAttributeMock('string', []);
    addAttributeMock('boolean', [{key: 'is_transaction', name: 'is_transaction'}]);

    const {result} = renderHookWithProviders(
      () =>
        useTraceItemAttributes(
          {
            traceItemType: TraceItemDataset.SPANS,
            enabled: true,
          },
          'number'
        ),
      {organization}
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect('is_transaction' in result.current.attributes).toBe(false);
    expect('custom_metric' in result.current.attributes).toBe(true);
  });

  it('filters number attributes that overlap with default boolean attributes', async () => {
    const organization = OrganizationFixture({
      features: ['search-query-builder-explicit-boolean-filters'],
    });

    addAttributeMock('number', [
      {key: 'is_transaction', name: 'is_transaction'},
      {key: 'custom_metric', name: 'custom_metric'},
    ]);
    addAttributeMock('string', []);
    addAttributeMock('boolean', []);

    const {result} = renderHookWithProviders(
      () =>
        useTraceItemAttributes(
          {
            traceItemType: TraceItemDataset.SPANS,
            enabled: true,
          },
          'number'
        ),
      {organization}
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect('is_transaction' in result.current.attributes).toBe(false);
    expect('custom_metric' in result.current.attributes).toBe(true);
  });

  it('filters tags[key,number] format when boolean version exists', async () => {
    const organization = OrganizationFixture({
      features: ['search-query-builder-explicit-boolean-filters'],
    });

    addAttributeMock('number', [
      {key: 'tags[is_transaction,number]', name: 'tags[is_transaction,number]'},
      {key: 'custom_metric', name: 'custom_metric'},
    ]);
    addAttributeMock('string', []);
    addAttributeMock('boolean', [
      {key: 'tags[is_transaction,boolean]', name: 'tags[is_transaction,boolean]'},
    ]);

    const {result} = renderHookWithProviders(
      () =>
        useTraceItemAttributes(
          {
            traceItemType: TraceItemDataset.SPANS,
            enabled: true,
          },
          'number'
        ),
      {organization}
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect('tags[is_transaction,number]' in result.current.attributes).toBe(false);
    expect('custom_metric' in result.current.attributes).toBe(true);
  });

  it('filters overlapping number secondary aliases when boolean version exists', async () => {
    const organization = OrganizationFixture({
      features: ['search-query-builder-explicit-boolean-filters'],
    });

    addAttributeMock('number', [
      {
        key: 'custom_metric',
        name: 'custom_metric',
        secondaryAliases: ['tags[is_transaction,number]', 'tags[custom_metric,number]'],
      },
    ]);
    addAttributeMock('string', []);
    addAttributeMock('boolean', [
      {key: 'tags[is_transaction,boolean]', name: 'tags[is_transaction,boolean]'},
    ]);

    const {result} = renderHookWithProviders(
      () =>
        useTraceItemAttributes(
          {
            traceItemType: TraceItemDataset.SPANS,
            enabled: true,
          },
          'number'
        ),
      {organization}
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect('tags[is_transaction,number]' in result.current.secondaryAliases).toBe(false);
    expect('tags[custom_metric,number]' in result.current.secondaryAliases).toBe(true);
  });

  it('preserves non-overlapping number attributes', async () => {
    const organization = OrganizationFixture({
      features: ['search-query-builder-explicit-boolean-filters'],
    });

    addAttributeMock('number', [
      {key: 'custom_metric', name: 'custom_metric'},
      {key: 'another_metric', name: 'another_metric'},
    ]);
    addAttributeMock('string', []);
    addAttributeMock('boolean', [{key: 'is_transaction', name: 'is_transaction'}]);

    const {result} = renderHookWithProviders(
      () =>
        useTraceItemAttributes(
          {
            traceItemType: TraceItemDataset.SPANS,
            enabled: true,
          },
          'number'
        ),
      {organization}
    );

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect('custom_metric' in result.current.attributes).toBe(true);
    expect('another_metric' in result.current.attributes).toBe(true);
  });
});
