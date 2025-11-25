import {useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import type {SelectOption} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';

import {Button} from 'sentry/components/core/button';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {HybridFilter} from 'sentry/components/organizations/hybridFilter';
import {
  modifyFilterOperatorQuery,
  modifyFilterValue,
} from 'sentry/components/searchQueryBuilder/hooks/useQueryBuilderState';
import {getOperatorInfo} from 'sentry/components/searchQueryBuilder/tokens/filter/filterOperator';
import {
  escapeTagValue,
  getFilterValueType,
  OP_LABELS,
} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import {
  getInitialInputValue,
  getPredefinedValues,
  getSelectedValuesFromText,
  prepareInputValueForSaving,
  tokenSupportsMultipleValues,
} from 'sentry/components/searchQueryBuilder/tokens/filter/valueCombobox';
import {TermOperator} from 'sentry/components/searchSyntax/parser';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {prettifyTagKey} from 'sentry/utils/fields';
import {keepPreviousData, useQuery} from 'sentry/utils/queryClient';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import usePageFilters from 'sentry/utils/usePageFilters';
import {type SearchBarData} from 'sentry/views/dashboards/datasetConfig/base';
import FilterSelectorTrigger from 'sentry/views/dashboards/globalFilter/filterSelectorTrigger';
import {
  getFieldDefinitionForDataset,
  getFilterToken,
  parseFilterValue,
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
  const {dataset, tag} = globalFilter;
  const {selection} = usePageFilters();

  const fieldDefinition = getFieldDefinitionForDataset(tag, dataset);
  const filterToken = useMemo(
    () => getFilterToken(globalFilter, fieldDefinition),
    [globalFilter, fieldDefinition]
  );

  // Get initial selected values from the filter token
  const initialValues = useMemo(() => {
    if (!filterToken) {
      return [];
    }
    const iniitalValue = getInitialInputValue(filterToken, true);
    const selectedValues = getSelectedValuesFromText(iniitalValue, {escaped: false});
    return selectedValues.map(item => item.value);
  }, [filterToken]);

  // Get operator info from the filter token
  const operatorInfo = useMemo(() => {
    if (!filterToken) {
      return null;
    }
    return getOperatorInfo({
      filterToken,
      hasWildcardOperators: true,
      fieldDefinition,
    });
  }, [filterToken, fieldDefinition]);

  const operatorOptions = operatorInfo?.options ?? [];
  const initialOperator = operatorInfo?.operator ?? TermOperator.DEFAULT;

  const [stagedOperator, setStagedOperator] = useState<TermOperator>(initialOperator);
  const [activeFilterValues, setActiveFilterValues] = useState<string[]>(initialValues);
  const [stagedFilterValues, setStagedFilterValues] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setActiveFilterValues(initialValues);
    setStagedFilterValues([]);
    setStagedOperator(initialOperator);
  }, [initialValues, initialOperator]);

  // Retrieve full tag definition to check if it has predefined values
  const datasetFilterKeys = searchBarData.getFilterKeys();
  const fullTag = datasetFilterKeys[tag.key];

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
      map.set(value, {label: value, value});

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
    if (isEqual(opts, activeFilterValues) && stagedOperator === initialOperator) {
      return;
    }
    if (!filterToken) {
      return;
    }
    setActiveFilterValues(opts);

    let newValue = '';
    if (opts.length !== 0) {
      const cleanedValue = prepareInputValueForSaving(
        getFilterValueType(filterToken, fieldDefinition),
        opts.map(opt => escapeTagValue(opt, {allowArrayValue: false})).join(',')
      );
      newValue = modifyFilterValue(filterToken.text, filterToken, cleanedValue);
    }

    if (stagedOperator !== initialOperator) {
      const newToken = parseFilterValue(newValue, globalFilter)[0] ?? filterToken;
      newValue = modifyFilterOperatorQuery(newToken.text, newToken, stagedOperator, true);
    }

    onUpdateFilter({
      ...globalFilter,
      value: newValue,
    });
  };

  const hasChanges = stagedFilterValues.length > 0 && stagedOperator !== initialOperator;

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
      hasExternalChanges={hasChanges}
      onStagedValueChange={value => {
        setStagedFilterValues(value);
      }}
      maxMenuWidth={400}
      sizeLimit={30}
      onClose={() => {
        setSearchQuery('');
        setStagedFilterValues([]);
        setStagedOperator(initialOperator);
      }}
      sizeLimitMessage={t('Use search to find more filter values…')}
      emptyMessage={
        isFetching ? t('Loading filter values...') : t('No filter values found')
      }
      menuTitle={
        <OperatorFlex>
          <DropdownMenu
            usePortal
            trigger={(triggerProps, isOpen) => (
              <WildcardButton gap="xs" align="center">
                <span>{prettifyTagKey(globalFilter.tag.key)}</span>
                <Button {...triggerProps} size="zero" borderless>
                  <Flex gap="xs" align="center">
                    <SubText>{OP_LABELS[stagedOperator]}</SubText>
                    <IconChevron direction={isOpen ? 'up' : 'down'} size="xs" />
                  </Flex>
                </Button>
              </WildcardButton>
            )}
            items={operatorOptions.map(option => ({
              ...option,
              key: option.value,
              label: option.label,
              textValue: option.textValue,
              onClick: () => {
                setStagedOperator(option.value);
              },
            }))}
          />
        </OperatorFlex>
      }
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
                setStagedOperator(TermOperator.DEFAULT);
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
            operator={initialOperator}
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

const OperatorFlex = styled(Flex)`
  margin-left: -${space(0.75)};
`;

const WildcardButton = styled(Flex)`
  align-items: center;
  padding: 0 ${space(1)};
`;

const SubText = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.sm};
`;
