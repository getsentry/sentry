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

  useEffect(() => {
    setActiveFilterValues(initialValues);
  }, [initialValues]);

  const {dataset, tag} = globalFilter;
  const pageFilters = usePageFilters();

  const baseQueryKey = useMemo(
    () => ['global-dashboard-filters-tag-values', tag, pageFilters.selection],
    [tag, pageFilters.selection]
  );
  const queryKey = useDebouncedValue(baseQueryKey);

  const queryResult = useQuery<string[]>({
    // Disable exhaustive deps because we want to debounce the query key above
    // eslint-disable-next-line @tanstack/query/exhaustive-deps
    queryKey,
    queryFn: async () => {
      const result = await searchBarData.getTagValues(tag, '');
      return result ?? [];
    },
    placeholderData: keepPreviousData,
    enabled: true,
  });

  const {data, isFetching} = queryResult;
  const fetchedOptions = useMemo(() => {
    if (!data) return [];
    return data.map(value => ({
      label: value,
      value,
    }));
  }, [data]);

  const savedFilterValueOptions = useMemo(() => {
    return activeFilterValues
      .map(value => ({
        label: value,
        value,
      }))
      .filter(option => !fetchedOptions.some(o => o.value === option.value));
  }, [activeFilterValues, fetchedOptions]);

  const options = [...savedFilterValueOptions, ...fetchedOptions];

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
