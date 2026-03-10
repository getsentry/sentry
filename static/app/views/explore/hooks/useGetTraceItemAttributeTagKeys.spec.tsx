import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/components/pageFilters/store';
import {FieldKind} from 'sentry/utils/fields';
import {useGetTraceItemAttributeTagKeys} from 'sentry/views/explore/hooks/useGetTraceItemAttributeTagKeys';
import {TraceItemDataset} from 'sentry/views/explore/types';

function mockTraceItemAttributeKeysByType({
  attributeType,
  body,
  itemType = TraceItemDataset.LOGS,
}: {
  attributeType: 'string' | 'number' | 'boolean';
  body: Array<{key: string; kind: FieldKind; name: string}>;
  itemType?: TraceItemDataset;
}) {
  return MockApiClient.addMockResponse({
    url: '/organizations/org-slug/trace-items/attributes/',
    body,
    match: [
      (_url, options) => {
        const query = options?.query || {};
        return query.itemType === itemType && query.attributeType === attributeType;
      },
    ],
  });
}

describe('useGetTraceItemAttributeTagKeys', () => {
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

  it('fetches and merges string, number, and boolean keys', async () => {
    mockTraceItemAttributeKeysByType({
      attributeType: 'string',
      body: [{key: 'log.field', name: 'log.field', kind: FieldKind.TAG}],
    });
    mockTraceItemAttributeKeysByType({
      attributeType: 'number',
      body: [{key: 'log.duration', name: 'log.duration', kind: FieldKind.MEASUREMENT}],
    });
    mockTraceItemAttributeKeysByType({
      attributeType: 'boolean',
      body: [{key: 'log.flag', name: 'log.flag', kind: FieldKind.BOOLEAN}],
    });

    const {result} = renderHookWithProviders(useGetTraceItemAttributeTagKeys, {
      initialProps: {
        itemType: TraceItemDataset.LOGS,
      },
    });

    const tags = await result.current('search-query');

    expect(tags).toHaveLength(3);
    expect(tags).toMatchObject([
      {key: 'log.field', name: 'log.field', kind: FieldKind.TAG},
      {key: 'log.duration', name: 'log.duration', kind: FieldKind.MEASUREMENT},
      {key: 'log.flag', name: 'log.flag', kind: FieldKind.BOOLEAN},
    ]);
  });

  it('deduplicates extraTags when keys overlap fetched keys', async () => {
    mockTraceItemAttributeKeysByType({
      attributeType: 'string',
      body: [{key: 'log.field', name: 'log.field', kind: FieldKind.TAG}],
    });
    mockTraceItemAttributeKeysByType({
      attributeType: 'number',
      body: [{key: 'log.duration', name: 'log.duration', kind: FieldKind.MEASUREMENT}],
    });
    mockTraceItemAttributeKeysByType({
      attributeType: 'boolean',
      body: [{key: 'log.flag', name: 'log.flag', kind: FieldKind.BOOLEAN}],
    });

    const {result} = renderHookWithProviders(useGetTraceItemAttributeTagKeys, {
      initialProps: {
        itemType: TraceItemDataset.LOGS,
        extraTags: {
          'log.duration': {
            key: 'log.duration',
            name: 'log.duration from extra',
            kind: FieldKind.MEASUREMENT,
          },
        },
      },
    });

    const tags = await result.current('search-query');

    expect(tags.filter(tag => tag.key === 'log.duration')).toHaveLength(1);
  });

  it('appends extraTags that are not in fetched results', async () => {
    mockTraceItemAttributeKeysByType({
      attributeType: 'string',
      body: [{key: 'log.field', name: 'log.field', kind: FieldKind.TAG}],
    });
    mockTraceItemAttributeKeysByType({
      attributeType: 'number',
      body: [],
    });
    mockTraceItemAttributeKeysByType({
      attributeType: 'boolean',
      body: [],
    });

    const {result} = renderHookWithProviders(useGetTraceItemAttributeTagKeys, {
      initialProps: {
        itemType: TraceItemDataset.LOGS,
        extraTags: {
          'function.count()': {
            key: 'function.count()',
            name: 'function.count()',
            kind: FieldKind.FUNCTION,
          },
        },
      },
    });

    const tags = await result.current('search-query');

    expect(tags).toHaveLength(2);
    expect(tags).toMatchObject([
      {key: 'log.field', name: 'log.field', kind: FieldKind.TAG},
      {
        key: 'function.count()',
        name: 'function.count()',
        kind: FieldKind.FUNCTION,
      },
    ]);
  });
});
