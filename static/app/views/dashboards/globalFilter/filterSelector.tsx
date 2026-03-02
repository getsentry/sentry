import {useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import {Button} from '@sentry/scraps/button';
import {Checkbox} from '@sentry/scraps/checkbox';
import {
  CompactSelect,
  MenuComponents,
  type SelectOption,
} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {
  HybridFilter,
  useStagedCompactSelect,
  type HybridFilterRef,
} from 'sentry/components/pageFilters/hybridFilter';
import usePageFilters from 'sentry/components/pageFilters/usePageFilters';
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
import {prettifyTagKey} from 'sentry/utils/fields';
import {keepPreviousData, useQuery} from 'sentry/utils/queryClient';
import {middleEllipsis} from 'sentry/utils/string/middleEllipsis';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {type SearchBarData} from 'sentry/views/dashboards/datasetConfig/base';
import {getDatasetLabel} from 'sentry/views/dashboards/globalFilter/addFilter';
import FilterSelectorTrigger, {
  FilterValueTruncated,
} from 'sentry/views/dashboards/globalFilter/filterSelectorTrigger';
import {
  getFieldDefinitionForDataset,
  getFilterToken,
  parseFilterValue,
} from 'sentry/views/dashboards/globalFilter/utils';
import {WidgetType, type GlobalFilter} from 'sentry/views/dashboards/types';
import {
  SpanFields,
  subregionCodeToName,
  type SubregionCode,
} from 'sentry/views/insights/types';

type FilterSelectorProps = {
  globalFilter: GlobalFilter;
  onRemoveFilter: (filter: GlobalFilter) => void;
  onUpdateFilter: (filter: GlobalFilter) => void;
  searchBarData: SearchBarData;
  disableRemoveFilter?: boolean;
};

function FilterSelector({
  globalFilter,
  searchBarData,
  onRemoveFilter,
  onUpdateFilter,
  disableRemoveFilter,
}: FilterSelectorProps) {
  const {selection} = usePageFilters();
  const hybridFilterRef = useRef<HybridFilterRef<string>>(null);

  const {fieldDefinition, filterToken} = useMemo(() => {
    const fieldDef = getFieldDefinitionForDataset(globalFilter.tag, globalFilter.dataset);
    return {
      fieldDefinition: fieldDef,
      filterToken: getFilterToken(globalFilter, fieldDef),
    };
  }, [globalFilter]);

  // Get initial selected values from the filter token
  const initialValues = useMemo(() => {
    if (!filterToken) {
      return [];
    }
    const initialValue = globalFilter.value
      ? getInitialInputValue(filterToken, true)
      : '';
    const selectedValues = getSelectedValuesFromText(initialValue, {escaped: false});
    return selectedValues.map(item => item.value);
  }, [filterToken, globalFilter.value]);

  // Get operator info from the filter token
  const {initialOperator, operatorDropdownItems} = useMemo(() => {
    if (!filterToken) {
      return {
        initialOperator: TermOperator.DEFAULT,
        operatorDropdownItems: [],
      };
    }

    const operatorInfo = getOperatorInfo({filterToken, fieldDefinition});

    return {
      initialOperator: operatorInfo?.operator ?? TermOperator.DEFAULT,
      operatorDropdownItems: (operatorInfo?.options ?? []).map(option => ({
        ...option,
        key: option.value,
        label: option.label,
        textValue: option.textValue,
        onClick: () => {
          setStagedOperator(option.value);
        },
      })),
    };
  }, [filterToken, fieldDefinition]);

  const [stagedOperator, setStagedOperator] = useState<TermOperator>(initialOperator);
  const [activeFilterValues, setActiveFilterValues] = useState<string[]>(initialValues);
  const [stagedFilterValues, setStagedFilterValues] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setActiveFilterValues(initialValues);
    setStagedFilterValues([]);
  }, [initialValues]);

  // Retrieve full tag definition to check if it has predefined values
  const datasetFilterKeys = searchBarData.getFilterKeys();
  const fullTag = datasetFilterKeys[globalFilter.tag.key];

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
    () =>
      [
        'global-dashboard-filters-tag-values',
        {
          key: globalFilter.tag.key,
          name: globalFilter.tag.name,
          kind: globalFilter.tag.kind,
        },
        selection,
        searchQuery,
      ] as const,
    [
      globalFilter.tag.key,
      globalFilter.tag.name,
      globalFilter.tag.kind,
      selection,
      searchQuery,
    ]
  );
  const queryKey = useDebouncedValue(baseQueryKey);

  const queryResult = useQuery({
    queryKey,
    queryFn: async ctx => {
      const result = await searchBarData.getTagValues(ctx.queryKey[1], ctx.queryKey[3]);
      return result ?? [];
    },
    placeholderData: keepPreviousData,
    enabled: shouldFetchValues,
    staleTime: 5 * 60 * 1000,
  });

  const {data: fetchedFilterValues, isFetching} = queryResult;

  const options = useMemo((): Array<SelectOption<string>> => {
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
    const addOption = (value: string, map: Map<string, SelectOption<string>>) => {
      const option: SelectOption<string> = {
        label: middleEllipsis(value, 70, /[\s-_:]/),
        value,
      };

      // Only add checkboxes for multi-select mode
      if (canSelectMultipleValues) {
        option.leadingItems = ({isSelected}: {isSelected: boolean}) => (
          <Checkbox
            checked={isSelected}
            onChange={() => hybridFilterRef.current?.toggleOption?.(value)}
            aria-label={t('Select %s', value)}
            tabIndex={-1}
          />
        );
      }

      return map.set(value, option);
    };

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

  const translatedOptions = translateKnownFilterOptions(options, globalFilter);

  const handleChange = (opts: string[]) => {
    if (isEqual(opts, activeFilterValues) && stagedOperator === initialOperator) {
      return;
    }
    if (!filterToken) {
      return;
    }

    setActiveFilterValues(opts);
    if (opts.length === 0) {
      setStagedOperator(TermOperator.DEFAULT);
      onUpdateFilter({
        ...globalFilter,
        value: '',
      });
      return;
    }

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
      newValue = modifyFilterOperatorQuery(newToken.text, newToken, stagedOperator);
    }

    onUpdateFilter({
      ...globalFilter,
      value: newValue,
    });
  };

  const hasOperatorChanges =
    stagedFilterValues.length > 0 && stagedOperator !== initialOperator;

  const stagedSelect = useStagedCompactSelect({
    value: activeFilterValues,
    defaultValue: [],
    options,
    onChange: handleChange,
    onStagedValueChange: setStagedFilterValues,
    multiple: true,
    hasExternalChanges: hasOperatorChanges,
  });

  const renderFilterSelectorTrigger = (filterValues: string[]) => (
    <FilterSelectorTrigger
      globalFilter={globalFilter}
      activeFilterValues={filterValues}
      operator={stagedOperator}
      options={translatedOptions}
      queryResult={queryResult}
    />
  );

  if (!canSelectMultipleValues) {
    return (
      <CompactSelect
        multiple={false}
        disabled={false}
        options={translatedOptions}
        value={activeFilterValues.length > 0 ? activeFilterValues[0] : undefined}
        onChange={option => {
          const newValue = option?.value;
          handleChange(newValue ? [newValue] : []);
        }}
        onClose={() => {
          setStagedFilterValues([]);
        }}
        menuTitle={
          <MenuTitleWrapper>
            {t('%s Filter', getDatasetLabel(globalFilter.dataset))}
          </MenuTitleWrapper>
        }
        menuHeaderTrailingItems={({closeOverlay}) => (
          <Flex gap="lg">
            {activeFilterValues.length > 0 && (
              <MenuComponents.ClearButton
                onClick={() => {
                  setSearchQuery('');
                  handleChange([]);
                }}
              />
            )}
            {!disableRemoveFilter && (
              <MenuComponents.HeaderButton
                aria-label={t('Remove Filter')}
                onClick={() => {
                  onRemoveFilter(globalFilter);
                  closeOverlay();
                }}
              >
                {t('Remove Filter')}
              </MenuComponents.HeaderButton>
            )}
          </Flex>
        )}
        trigger={triggerProps => (
          <OverlayTrigger.Button {...triggerProps}>
            {renderFilterSelectorTrigger(activeFilterValues)}
          </OverlayTrigger.Button>
        )}
      />
    );
  }

  return (
    <HybridFilter
      ref={hybridFilterRef}
      stagedSelect={stagedSelect}
      search={{
        placeholder: t('Search or enter a custom value...'),
        onChange: setSearchQuery,
      }}
      disabled={false}
      options={translatedOptions}
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
      menuFooter={
        stagedSelect.hasStagedChanges ? (
          <Flex gap="md" align="center" justify="end">
            <MenuComponents.CancelButton
              onClick={() => stagedSelect.removeStagedChanges()}
            />
            <MenuComponents.ApplyButton
              onClick={() => stagedSelect.commit(stagedSelect.stagedValue)}
            />
          </Flex>
        ) : null
      }
      menuTitle={
        <MenuTitleWrapper>
          <OperatorFlex>
            <DropdownMenu
              usePortal
              trigger={(triggerProps, isOpen) => (
                <WildcardButton gap="xs" align="center">
                  <FilterValueTruncated>
                    {prettifyTagKey(globalFilter.tag.key)}
                  </FilterValueTruncated>
                  <Button {...triggerProps} size="zero" priority="transparent">
                    <Flex gap="xs" align="center">
                      <SubText>{OP_LABELS[stagedOperator]}</SubText>
                      <IconChevron direction={isOpen ? 'up' : 'down'} size="xs" />
                    </Flex>
                  </Button>
                </WildcardButton>
              )}
              items={operatorDropdownItems}
            />
          </OperatorFlex>
        </MenuTitleWrapper>
      }
      menuHeaderTrailingItems={({closeOverlay}) => (
        <Flex gap="lg">
          {activeFilterValues.length > 0 && (
            <MenuComponents.ClearButton
              onClick={() => {
                setSearchQuery('');
                handleChange([]);
              }}
            />
          )}
          {!disableRemoveFilter && (
            <MenuComponents.HeaderButton
              onClick={() => {
                onRemoveFilter(globalFilter);
                closeOverlay();
              }}
            >
              {t('Remove Filter')}
            </MenuComponents.HeaderButton>
          )}
        </Flex>
      )}
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps}>
          {renderFilterSelectorTrigger(stagedFilterValues)}
        </OverlayTrigger.Button>
      )}
    />
  );
}

const translateKnownFilterOptions = (
  options: Array<SelectOption<string>>,
  globalFilter: GlobalFilter
) => {
  const key = globalFilter.tag.key;
  const dataset = globalFilter.dataset;

  if (key === SpanFields.USER_GEO_SUBREGION && dataset === WidgetType.SPANS) {
    return options.map(option => ({
      ...option,
      label: subregionCodeToName[option.value as SubregionCode] || option.label,
    }));
  }
  return options;
};

export default FilterSelector;

export const MenuTitleWrapper = styled('span')`
  display: inline-block;
  padding-top: ${p => p.theme.space.xs};
  padding-bottom: ${p => p.theme.space.xs};
`;

const OperatorFlex = styled(Flex)`
  margin-left: -${p => p.theme.space.sm};
`;

const WildcardButton = styled(Flex)`
  padding: 0 ${p => p.theme.space.md};
`;

const SubText = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
`;
