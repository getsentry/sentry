import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {
  extractBaseKey,
  shouldRemoveAttributeKey,
  useTraceItemAttributes,
} from 'sentry/views/explore/hooks/useTraceItemAttributes';
import {TraceItemDataset} from 'sentry/views/explore/types';

describe('extractBaseKey', () => {
  const testCases = [
    {input: 'is_transaction', expected: 'is_transaction'},
    {input: 'tags[is_transaction,boolean]', expected: 'is_transaction'},
    {input: 'tags[is_transaction,number]', expected: 'is_transaction'},
    {input: 'tags[my_tag,string]', expected: 'my_tag'},
    {input: 'span.duration', expected: 'span.duration'},
    {input: 'tags[my.tag.name,boolean]', expected: 'my.tag.name'},
    {input: 'tags[my-tag,number]', expected: 'my-tag'},
    {
      input: 'tags[custom.metric@primary,number]',
      expected: 'custom.metric@primary',
    },
    {input: 'tags[my:tag,string]', expected: 'my:tag'},
  ];

  testCases.forEach(({input, expected}) => {
    it(`returns ${expected} for ${input}`, () => {
      expect(extractBaseKey(input)).toBe(expected);
    });
  });
});

describe('shouldRemoveNumberKey', () => {
  const testCases = [
    {input: 'is_transaction', booleanBaseKeys: ['is_transaction'], expected: true},
    {
      input: 'tags[is_transaction,number]',
      booleanBaseKeys: ['is_transaction'],
      expected: true,
    },
    {input: 'span.duration', booleanBaseKeys: ['is_transaction'], expected: false},
    {input: 'tags[my-tag,number]', booleanBaseKeys: ['is_transaction'], expected: false},
    {
      input: 'tags[custom.metric@primary,number]',
      booleanBaseKeys: ['custom.metric@primary'],
      expected: true,
    },
    {input: 'tags[my:tag,string]', booleanBaseKeys: ['is_transaction'], expected: false},
  ];

  testCases.forEach(({input, booleanBaseKeys, expected}) => {
    it(`returns ${expected} for ${input}`, () => {
      expect(shouldRemoveAttributeKey(input, new Set(booleanBaseKeys))).toBe(expected);
    });
  });
});

function addAttributeMock(
  body: Array<{
    attributeType: 'string' | 'number' | 'boolean';
    key: string;
    name: string;
    secondaryAliases?: string[];
  }>
) {
  MockApiClient.addMockResponse({
    url: '/organizations/org-slug/trace-items/attributes/',
    body,
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

  it('filters out number attributes that overlap with boolean attributes', async () => {
    const organization = OrganizationFixture();

    addAttributeMock([
      {attributeType: 'number', key: 'is_transaction', name: 'is_transaction'},
      {attributeType: 'number', key: 'custom_metric', name: 'custom_metric'},
      {attributeType: 'boolean', key: 'is_transaction', name: 'is_transaction'},
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

    expect('is_transaction' in result.current.attributes).toBe(false);
    expect('custom_metric' in result.current.attributes).toBe(true);
  });

  it('filters number attributes that overlap with default boolean attributes', async () => {
    const organization = OrganizationFixture();

    addAttributeMock([
      {attributeType: 'number', key: 'is_transaction', name: 'is_transaction'},
      {attributeType: 'number', key: 'custom_metric', name: 'custom_metric'},
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

    expect('is_transaction' in result.current.attributes).toBe(false);
    expect('custom_metric' in result.current.attributes).toBe(true);
  });

  it('filters tags[key,number] format when boolean version exists', async () => {
    const organization = OrganizationFixture();

    addAttributeMock([
      {
        attributeType: 'number',
        key: 'tags[is_transaction,number]',
        name: 'tags[is_transaction,number]',
      },
      {attributeType: 'number', key: 'custom_metric', name: 'custom_metric'},
      {
        attributeType: 'boolean',
        key: 'tags[is_transaction,boolean]',
        name: 'tags[is_transaction,boolean]',
      },
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
    const organization = OrganizationFixture();

    addAttributeMock([
      {
        attributeType: 'number',
        key: 'custom_metric',
        name: 'custom_metric',
        secondaryAliases: ['tags[is_transaction,number]', 'tags[custom_metric,number]'],
      },
      {
        attributeType: 'boolean',
        key: 'tags[is_transaction,boolean]',
        name: 'tags[is_transaction,boolean]',
      },
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
    const organization = OrganizationFixture();

    addAttributeMock([
      {attributeType: 'number', key: 'custom_metric', name: 'custom_metric'},
      {attributeType: 'number', key: 'another_metric', name: 'another_metric'},
      {attributeType: 'boolean', key: 'is_transaction', name: 'is_transaction'},
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

    expect('custom_metric' in result.current.attributes).toBe(true);
    expect('another_metric' in result.current.attributes).toBe(true);
  });

  it('keeps both a numeric metric and a boolean tag that share a base key for trace metrics', async () => {
    const organization = OrganizationFixture();

    // Numeric metric and an unrelated boolean tag sharing a base key.
    addAttributeMock([
      {attributeType: 'number', key: 'value', name: 'value'},
      {attributeType: 'boolean', key: 'tags[value,boolean]', name: 'value'},
    ]);

    const {result} = renderHookWithProviders(
      () => ({
        number: useTraceItemAttributes(
          {traceItemType: TraceItemDataset.TRACEMETRICS, enabled: true},
          'number'
        ),
        boolean: useTraceItemAttributes(
          {traceItemType: TraceItemDataset.TRACEMETRICS, enabled: true},
          'boolean'
        ),
      }),
      {organization}
    );

    await waitFor(() => {
      expect(result.current.number.isLoading).toBe(false);
      expect(result.current.boolean.isLoading).toBe(false);
    });

    // The numeric metric survives the dedup instead of being dropped...
    expect('value' in result.current.number.attributes).toBe(true);
    // ...and the boolean tag is still present too.
    expect('tags[value,boolean]' in result.current.boolean.attributes).toBe(true);
  });
});
