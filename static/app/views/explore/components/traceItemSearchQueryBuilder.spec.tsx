import {OrganizationFixture} from 'sentry-fixture/organization';

import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {FieldKind} from 'sentry/utils/fields';
import {
  useTraceItemSearchQueryBuilderProps,
  type TraceItemSearchQueryBuilderProps,
} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {TraceItemDataset} from 'sentry/views/explore/types';

const defaultInitialProps: TraceItemSearchQueryBuilderProps = {
  itemType: TraceItemDataset.SPANS,
  booleanAttributes: {},
  booleanSecondaryAliases: {},
  numberAttributes: {},
  numberSecondaryAliases: {},
  stringAttributes: {},
  stringSecondaryAliases: {},
  initialQuery: '',
  searchSource: 'test',
};
const organization = OrganizationFixture({
  features: ['search-query-builder-explicit-boolean-filters'],
});

describe('useTraceItemSearchQueryBuilderProps', () => {
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

  it('wires boolean attributes into filter keys, aliases, and sections', () => {
    const {result} = renderHookWithProviders(useTraceItemSearchQueryBuilderProps, {
      initialProps: {
        ...defaultInitialProps,
        booleanAttributes: {
          'feature.enabled': {
            key: 'feature.enabled',
            name: 'feature.enabled',
            kind: FieldKind.BOOLEAN,
          },
        },
        booleanSecondaryAliases: {
          'feature.enabled_alias': {
            key: 'feature.enabled_alias',
            name: 'feature.enabled_alias',
            kind: FieldKind.BOOLEAN,
          },
        },
      },
      organization,
    });

    expect(result.current.filterKeys['feature.enabled']).toBeDefined();
    expect(result.current.filterKeyAliases?.['feature.enabled_alias']).toBeDefined();
  });

  it('wires number attributes into filter keys and aliases', () => {
    const {result} = renderHookWithProviders(useTraceItemSearchQueryBuilderProps, {
      initialProps: {
        ...defaultInitialProps,
        numberAttributes: {
          'transaction.duration': {
            key: 'transaction.duration',
            name: 'transaction.duration',
            kind: FieldKind.MEASUREMENT,
          },
        },
        numberSecondaryAliases: {
          'transaction.duration_alias': {
            key: 'transaction.duration_alias',
            name: 'transaction.duration_alias',
            kind: FieldKind.MEASUREMENT,
          },
        },
      },
      organization,
    });

    expect(result.current.filterKeys['transaction.duration']).toBeDefined();
    expect(result.current.filterKeyAliases?.['transaction.duration_alias']).toBeDefined();
  });

  it('wires string attributes into filter keys and aliases', () => {
    const {result} = renderHookWithProviders(useTraceItemSearchQueryBuilderProps, {
      initialProps: {
        ...defaultInitialProps,
        stringAttributes: {
          'log.message': {
            key: 'log.message',
            name: 'log.message',
            kind: FieldKind.TAG,
          },
        },
        stringSecondaryAliases: {
          'log.message_alias': {
            key: 'log.message_alias',
            name: 'log.message_alias',
            kind: FieldKind.TAG,
          },
        },
      },
      organization,
    });

    expect(result.current.filterKeys['log.message']).toBeDefined();
    expect(result.current.filterKeyAliases?.['log.message_alias']).toBeDefined();
  });

  it('merges all secondary alias types into filterKeyAliases', () => {
    const {result} = renderHookWithProviders(useTraceItemSearchQueryBuilderProps, {
      initialProps: {
        ...defaultInitialProps,
        booleanSecondaryAliases: {
          'feature.enabled_alias': {
            key: 'feature.enabled_alias',
            name: 'feature.enabled_alias',
            kind: FieldKind.BOOLEAN,
          },
        },
        numberSecondaryAliases: {
          'transaction.duration_alias': {
            key: 'transaction.duration_alias',
            name: 'transaction.duration_alias',
            kind: FieldKind.MEASUREMENT,
          },
        },
        stringSecondaryAliases: {
          'log.message_alias': {
            key: 'log.message_alias',
            name: 'log.message_alias',
            kind: FieldKind.TAG,
          },
        },
      },
      organization,
    });

    expect(result.current.filterKeyAliases).toMatchObject({
      'feature.enabled_alias': expect.any(Object),
      'transaction.duration_alias': expect.any(Object),
      'log.message_alias': expect.any(Object),
    });
  });

  it('exposes getTagKeys and allows unsupported filters when async keys are enabled', () => {
    const {result} = renderHookWithProviders(useTraceItemSearchQueryBuilderProps, {
      initialProps: defaultInitialProps,
      organization,
    });

    expect(result.current.getTagKeys).toEqual(expect.any(Function));
    expect(result.current.disallowUnsupportedFilters).toBe(false);
  });

  it('disables recent searches regardless of item type when disableRecentSearches is true', () => {
    for (const itemType of [
      TraceItemDataset.SPANS,
      TraceItemDataset.LOGS,
      TraceItemDataset.TRACEMETRICS,
    ]) {
      const {result} = renderHookWithProviders(useTraceItemSearchQueryBuilderProps, {
        initialProps: {
          ...defaultInitialProps,
          itemType,
          disableRecentSearches: true,
        },
        organization,
      });

      expect(result.current.recentSearches).toBeUndefined();
      expect(result.current.namespace).toBeUndefined();
    }
  });

  it('enables recent searches by default', () => {
    const {result} = renderHookWithProviders(useTraceItemSearchQueryBuilderProps, {
      initialProps: defaultInitialProps,
      organization,
    });

    expect(result.current.recentSearches).toBeDefined();
  });

  it('getTagKeys fetches keys across string, number, and boolean attributes', async () => {
    const stringMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [{key: 'log.message', name: 'log.message'}],
      match: [
        (_url, options) => {
          const query = options?.query || {};
          return (
            query.attributeType === 'string' && query.itemType === TraceItemDataset.SPANS
          );
        },
      ],
    });
    const numberMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [{key: 'log.duration', name: 'log.duration'}],
      match: [
        (_url, options) => {
          const query = options?.query || {};
          return (
            query.attributeType === 'number' && query.itemType === TraceItemDataset.SPANS
          );
        },
      ],
    });
    const booleanMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/trace-items/attributes/',
      body: [{key: 'log.flag', name: 'log.flag'}],
      match: [
        (_url, options) => {
          const query = options?.query || {};
          return (
            query.attributeType === 'boolean' && query.itemType === TraceItemDataset.SPANS
          );
        },
      ],
    });

    const {result} = renderHookWithProviders(useTraceItemSearchQueryBuilderProps, {
      initialProps: defaultInitialProps,
      organization,
    });
    const tags = await result.current.getTagKeys?.('search-query');

    expect(stringMock).toHaveBeenCalled();
    expect(numberMock).toHaveBeenCalled();
    expect(booleanMock).toHaveBeenCalled();
    expect(tags?.map(tag => tag.key)).toEqual([
      'log.message',
      'log.duration',
      'log.flag',
    ]);
  });
});
