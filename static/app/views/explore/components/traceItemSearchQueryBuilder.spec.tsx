import {renderHookWithProviders} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {FieldKind} from 'sentry/utils/fields';
import {useTraceItemSearchQueryBuilderProps} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {TraceItemDataset} from 'sentry/views/explore/types';

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

  it('wires boolean attributes into filter keys, aliases, and sections', () => {
    const booleanAttributes = {
      'feature.enabled': {
        key: 'feature.enabled',
        name: 'feature.enabled',
        kind: FieldKind.BOOLEAN,
      },
    };
    const booleanSecondaryAliases = {
      'feature.enabled_alias': {
        key: 'feature.enabled_alias',
        name: 'feature.enabled_alias',
        kind: FieldKind.BOOLEAN,
      },
    };

    const {result} = renderHookWithProviders(useTraceItemSearchQueryBuilderProps, {
      organization: {
        features: ['search-query-builder-explicit-boolean-filters'],
      },
      initialProps: {
        itemType: TraceItemDataset.SPANS,
        booleanAttributes,
        booleanSecondaryAliases,
        numberAttributes: {},
        numberSecondaryAliases: {},
        stringAttributes: {},
        stringSecondaryAliases: {},
        initialQuery: '',
        searchSource: 'test',
      },
    });

    expect(result.current.filterKeys['feature.enabled']).toBeDefined();
    expect(result.current.filterKeyAliases?.['feature.enabled_alias']).toBeDefined();
  });
});
