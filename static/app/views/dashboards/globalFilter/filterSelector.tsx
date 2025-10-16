import {useEffect, useMemo, useState} from 'react';
import isEqual from 'lodash/isEqual';

import {Button} from 'sentry/components/core/button';
import {HybridFilter} from 'sentry/components/organizations/hybridFilter';
import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import {t} from 'sentry/locale';
import {keepPreviousData, useQuery} from 'sentry/utils/queryClient';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import usePageFilters from 'sentry/utils/usePageFilters';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {getDatasetLabel} from 'sentry/views/dashboards/globalFilter/addFilter';
import FilterSelectorTrigger from 'sentry/views/dashboards/globalFilter/filterSelectorTrigger';
import type {GlobalFilter} from 'sentry/views/dashboards/types';

type FilterSelectorProps = {
  globalFilter: GlobalFilter;
  onRemoveFilter: (filter: GlobalFilter) => void;
  onUpdateFilter: (filter: GlobalFilter) => void;
};

function FilterSelector({
  globalFilter,
  onRemoveFilter,
  onUpdateFilter,
}: FilterSelectorProps) {
  // Parse global filter condition to retrieve initial state
  const initialValues = useMemo(() => {
    const mutableSearch = new MutableSearch(globalFilter.value);
    return mutableSearch.getFilterValues(globalFilter.tag.key);
  }, [globalFilter]);

  const [activeFilterValues, setActiveFilterValues] = useState<string[]>(initialValues);

  useEffect(() => {
    setActiveFilterValues(initialValues);
  }, [initialValues]);

  const {dataset, tag} = globalFilter;
  const {selection} = usePageFilters();
  const dataProvider = getDatasetConfig(dataset).useSearchBarDataProvider!({
    pageFilters: selection,
  });

  const baseQueryKey = useMemo(() => ['global-dashboard-filters-tag-values', tag], [tag]);
  const queryKey = useDebouncedValue(baseQueryKey);

  const queryResult = useQuery<string[]>({
    // Disable exhaustive deps because we want to debounce the query key above
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey,
    queryFn: async () => {
      const result = await dataProvider?.getTagValues(tag, '');
      return result ?? [];
    },
    placeholderData: keepPreviousData,
    enabled: true,
  });

  const {data, isFetching} = queryResult;
  const options = useMemo(() => {
    if (!data) return [];
    return data.map(value => ({
      label: value,
      value,
    }));
  }, [data]);

  const handleChange = (opts: string[]) => {
    if (isEqual(opts, activeFilterValues)) {
      return;
    }
    setActiveFilterValues(opts);

    // Build filter condition string
    const filterValue = () => {
      if (opts.length === 0) {
        return '';
      }
      const mutableSearch = new MutableSearch('');
      return mutableSearch.addFilterValueList(tag.key, opts).toString();
    };

    onUpdateFilter({
      ...globalFilter,
      value: filterValue(),
    });
  };

  return (
    <HybridFilter
      checkboxPosition="leading"
      searchable
      disabled={false}
      options={options}
      value={activeFilterValues}
      defaultValue={[]}
      onChange={handleChange}
      sizeLimit={10}
      sizeLimitMessage={t('Use search to find more filter values…')}
      onReset={() => {
        setActiveFilterValues([]);
        onUpdateFilter({
          ...globalFilter,
          value: '',
        });
      }}
      emptyMessage={
        isFetching ? t('Loading filter values...') : t('No filter values found')
      }
      menuTitle={t('%s filter', getDatasetLabel(dataset))}
      menuHeaderTrailingItems={
        <Button
          aria-label={t('Remove Filter')}
          borderless
          size="xs"
          priority="link"
          onClick={() => onRemoveFilter(globalFilter)}
        >
          {t('Remove')}
        </Button>
      }
      triggerProps={{
        children: (
          <FilterSelectorTrigger
            globalFilter={globalFilter}
            activeFilterValues={activeFilterValues}
            options={options}
            queryResult={queryResult}
          />
        ),
      }}
    />
  );
}

export default FilterSelector;
