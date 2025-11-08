import {useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {Flex} from '@sentry/scraps/layout';

import {Button} from 'sentry/components/core/button';
import {HybridFilter} from 'sentry/components/organizations/hybridFilter';
import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {keepPreviousData, useQuery} from 'sentry/utils/queryClient';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import usePageFilters from 'sentry/utils/usePageFilters';
import {type SearchBarData} from 'sentry/views/dashboards/datasetConfig/base';
import {getDatasetLabel} from 'sentry/views/dashboards/globalFilter/addFilter';
import FilterSelectorTrigger from 'sentry/views/dashboards/globalFilter/filterSelectorTrigger';
import type {GlobalFilter} from 'sentry/views/dashboards/types';

type FilterSelectorProps = {
  globalFilter: GlobalFilter;
  onRemoveFilter: (filter: GlobalFilter) => void;
  onUpdateFilter: (filter: GlobalFilter) => void;
  searchBarData: SearchBarData;
};

function FilterSelector({
  globalFilter,
  searchBarData,
  onRemoveFilter,
  onUpdateFilter,
}: FilterSelectorProps) {
  // Parse global filter condition to retrieve initial state
  const initialValues = useMemo(() => {
    const mutableSearch = new MutableSearch(globalFilter.value);
    return mutableSearch.getFilterValues(globalFilter.tag.key);
  }, [globalFilter]);

  const [activeFilterValues, setActiveFilterValues] = useState<string[]>(initialValues);
  const [stagedFilterValues, setStagedFilterValues] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setActiveFilterValues(initialValues);
    setStagedFilterValues([]);
  }, [initialValues]);

  const {dataset, tag} = globalFilter;
  const {selection} = usePageFilters();

  const baseQueryKey = useMemo(
    () => ['global-dashboard-filters-tag-values', tag, selection, searchQuery],
    [tag, selection, searchQuery]
  );
  const queryKey = useDebouncedValue(baseQueryKey);

  const queryResult = useQuery<string[]>({
    // Disable exhaustive deps because we want to debounce the query key above
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey,
    queryFn: async () => {
      const result = await searchBarData.getTagValues(tag, searchQuery);
      return result ?? [];
    },
    placeholderData: keepPreviousData,
    enabled: true,
    staleTime: 5 * 60 * 1000,
  });

  const {data: fetchedFilterValues, isFetching} = queryResult;

  const options = useMemo(() => {
    const optionMap = new Map<string, {label: string; value: string}>();
    const addOption = (value: string) => optionMap.set(value, {label: value, value});

    // Filter values fetched using getTagValues
    fetchedFilterValues?.forEach(addOption);
    // Filter values in the global filter
    activeFilterValues.forEach(addOption);
    // Staged filter values inside the filter selector
    stagedFilterValues.forEach(addOption);

    // Allow setting a custom filter value based on search input
    if (searchQuery) {
      addOption(searchQuery);
    }

    // Reversing the order allows effectively deduplicating the values
    // and avoid losing their original order from the fetched results
    // (e.g. without this, all staged values would be grouped at the top of the list)
    return Array.from(optionMap.values()).reverse();
  }, [fetchedFilterValues, activeFilterValues, stagedFilterValues, searchQuery]);

  const handleChange = (opts: string[]) => {
    if (isEqual(opts, activeFilterValues)) {
      return;
    }
    setActiveFilterValues(opts);

    // Build filter condition string
    const mutableSearch = new MutableSearch('');

    let filterValue = '';
    if (opts.length === 1) {
      filterValue = mutableSearch.addFilterValue(tag.key, opts[0]!).toString();
    } else if (opts.length > 1) {
      filterValue = mutableSearch.addFilterValueList(tag.key, opts).toString();
    }
    onUpdateFilter({
      ...globalFilter,
      value: filterValue,
    });
  };

  return (
    <HybridFilter
      checkboxPosition="leading"
      searchable
      disabled={false}
      options={options}
      value={activeFilterValues}
      searchPlaceholder={t('Search filter values...')}
      onSearch={setSearchQuery}
      defaultValue={[]}
      onChange={handleChange}
      onStagedValueChange={value => {
        setStagedFilterValues(value);
      }}
      sizeLimit={10}
      onClose={() => {
        setSearchQuery('');
        setStagedFilterValues([]);
      }}
      sizeLimitMessage={t('Use search to find more filter values…')}
      emptyMessage={
        isFetching ? t('Loading filter values...') : t('No filter values found')
      }
      menuTitle={t('%s Filter', getDatasetLabel(dataset))}
      menuHeaderTrailingItems={({closeOverlay}: any) => (
        <Flex gap="md">
          {activeFilterValues.length > 0 && (
            <StyledButton
              aria-label={t('Clear Selections')}
              size="zero"
              borderless
              onClick={() => {
                setSearchQuery('');
                handleChange([]);
                closeOverlay();
              }}
            >
              {t('Clear')}
            </StyledButton>
          )}
          <StyledButton
            aria-label={t('Remove Filter')}
            size="zero"
            onClick={() => onRemoveFilter(globalFilter)}
          >
            {t('Remove Filter')}
          </StyledButton>
        </Flex>
      )}
      triggerProps={{
        children: (
          <FilterSelectorTrigger
            globalFilter={globalFilter}
            activeFilterValues={initialValues}
            options={options}
            queryResult={queryResult}
          />
        ),
      }}
    />
  );
}

export default FilterSelector;

const StyledButton = styled(Button)`
  font-size: inherit;
  font-weight: ${p => p.theme.fontWeight.normal};
  color: ${p => p.theme.subText};
  padding: 0 ${space(0.5)};
  margin: ${p =>
    p.theme.isChonk
      ? `-${space(0.5)} -${space(0.5)}`
      : `-${space(0.25)} -${space(0.25)}`};
`;
