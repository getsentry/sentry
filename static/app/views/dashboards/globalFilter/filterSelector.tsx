import {useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {CompactSelect, type SelectOption} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';

import {Button} from 'sentry/components/core/button';
import {HybridFilter} from 'sentry/components/organizations/hybridFilter';
import {
  getPredefinedValues,
  tokenSupportsMultipleValues,
} from 'sentry/components/searchQueryBuilder/tokens/filter/valueCombobox';
import {MutableSearch} from 'sentry/components/searchSyntax/mutableSearch';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {keepPreviousData, useQuery} from 'sentry/utils/queryClient';
import {middleEllipsis} from 'sentry/utils/string/middleEllipsis';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import usePageFilters from 'sentry/utils/usePageFilters';
import {type SearchBarData} from 'sentry/views/dashboards/datasetConfig/base';
import {getDatasetLabel} from 'sentry/views/dashboards/globalFilter/addFilter';
import FilterSelectorTrigger from 'sentry/views/dashboards/globalFilter/filterSelectorTrigger';
import {
  getFieldDefinitionForDataset,
  getFilterToken,
} from 'sentry/views/dashboards/globalFilter/utils';
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

  // Retrieve full tag definition to check if it has predefined values
  const datasetFilterKeys = searchBarData.getFilterKeys();
  const fullTag = datasetFilterKeys[tag.key];
  const fieldDefinition = getFieldDefinitionForDataset(tag, dataset);

  const filterToken = useMemo(
    () => getFilterToken(globalFilter, fieldDefinition),
    [globalFilter, fieldDefinition]
  );

  const canSelectMultipleValues = filterToken
    ? tokenSupportsMultipleValues(filterToken, datasetFilterKeys, fieldDefinition)
    : true;

  // Retrieve predefined values if the tag has any
  const predefinedValues = useMemo(() => {
    if (!filterToken) {
      return null;
    }
    const filterValue = filterToken.value.text;
    return getPredefinedValues({
      key: fullTag,
      filterValue,
      token: filterToken,
      fieldDefinition,
    });
  }, [fullTag, filterToken, fieldDefinition]);

  // Only fetch values if the tag has no predefined values
  const shouldFetchValues = fullTag
    ? !fullTag.predefined && predefinedValues === null
    : true;

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
    enabled: shouldFetchValues,
    staleTime: 5 * 60 * 1000,
  });

  const {data: fetchedFilterValues, isFetching} = queryResult;

  const options = useMemo(() => {
    if (predefinedValues && !canSelectMultipleValues) {
      return predefinedValues.flatMap(section =>
        section.suggestions.map(suggestion => ({
          label: suggestion.value,
          value: suggestion.value,
        }))
      );
    }

    const optionMap = new Map<string, SelectOption<string>>();
    const fixedOptionMap = new Map<string, SelectOption<string>>();
    const addOption = (value: string, map: Map<string, SelectOption<string>>) =>
      map.set(value, {
        label: middleEllipsis(value, 70, /[\s-_:]/),
        value,
      });

    // Filter values in the global filter
    activeFilterValues.forEach(value => addOption(value, optionMap));

    // Predefined values
    predefinedValues?.forEach(suggestionSection => {
      suggestionSection.suggestions.forEach(suggestion =>
        addOption(suggestion.value, optionMap)
      );
    });
    // Filter values fetched using getTagValues
    fetchedFilterValues?.forEach(value => addOption(value, optionMap));

    // Allow setting a custom filter value based on search input
    if (searchQuery && !optionMap.has(searchQuery)) {
      addOption(searchQuery, fixedOptionMap);
    }
    // Staged filter values inside the filter selector
    stagedFilterValues.forEach(value => {
      if (!optionMap.has(value)) {
        addOption(value, fixedOptionMap);
      }
    });
    return [...Array.from(fixedOptionMap.values()), ...Array.from(optionMap.values())];
  }, [
    fetchedFilterValues,
    predefinedValues,
    activeFilterValues,
    stagedFilterValues,
    searchQuery,
    canSelectMultipleValues,
  ]);

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

  const renderMenuHeaderTrailingItems = ({closeOverlay}: any) => (
    <Flex gap="lg">
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
  );

  const renderFilterSelectorTrigger = () => (
    <FilterSelectorTrigger
      globalFilter={globalFilter}
      activeFilterValues={initialValues}
      options={options}
      queryResult={queryResult}
    />
  );

  if (!canSelectMultipleValues) {
    return (
      <CompactSelect
        multiple={false}
        disabled={false}
        options={options}
        value={activeFilterValues.length > 0 ? activeFilterValues[0] : undefined}
        onChange={option => {
          const newValue = option?.value;
          handleChange(newValue ? [newValue] : []);
        }}
        onClose={() => {
          setStagedFilterValues([]);
        }}
        menuTitle={
          <MenuTitleWrapper>{t('%s Filter', getDatasetLabel(dataset))}</MenuTitleWrapper>
        }
        menuHeaderTrailingItems={renderMenuHeaderTrailingItems}
        triggerProps={{
          children: renderFilterSelectorTrigger(),
        }}
      />
    );
  }

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
      sizeLimit={30}
      onClose={() => {
        setSearchQuery('');
        setStagedFilterValues([]);
      }}
      sizeLimitMessage={t('Use search to find more filter values…')}
      emptyMessage={
        isFetching ? t('Loading filter values...') : t('No filter values found')
      }
      menuTitle={
        <MenuTitleWrapper>{t('%s Filter', getDatasetLabel(dataset))}</MenuTitleWrapper>
      }
      menuHeaderTrailingItems={renderMenuHeaderTrailingItems}
      triggerProps={{
        children: renderFilterSelectorTrigger(),
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
      ? `-${p.theme.space.xs} -${p.theme.space.xs}`
      : `-${p.theme.space['2xs']} -${p.theme.space['2xs']}`};
`;

export const MenuTitleWrapper = styled('span')`
  display: inline-block;
  padding-top: ${p => p.theme.space.xs};
  padding-bottom: ${p => p.theme.space.xs};
`;
