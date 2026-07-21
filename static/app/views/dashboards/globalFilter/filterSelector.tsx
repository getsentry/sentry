import {useEffect, useMemo, useRef, useState} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {keepPreviousData, useQuery} from '@tanstack/react-query';
import isEqual from 'lodash/isEqual';
import xor from 'lodash/xor';

import {Button} from '@sentry/scraps/button';
import {Checkbox} from '@sentry/scraps/checkbox';
import {
  CompactSelect,
  MenuComponents,
  type SelectOption,
} from '@sentry/scraps/compactSelect';
import {Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {useStagedCompactSelect} from 'sentry/components/pageFilters/useStagedCompactSelect';
import {modifyFilterValue} from 'sentry/components/searchQueryBuilder/hooks/useQueryBuilderState';
import {getOperatorInfo} from 'sentry/components/searchQueryBuilder/tokens/filter/filterOperator';
import {
  escapeTagValueForSearch,
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
import {emptyValue, EMPTY_VALUE_LABEL} from 'sentry/utils/discover/emptyFieldValues';
import {prettifyTagKey} from 'sentry/utils/fields';
import {middleEllipsis} from 'sentry/utils/string/middleEllipsis';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';
import {type SearchBarData} from 'sentry/views/dashboards/datasetConfig/base';
import {getDatasetLabel} from 'sentry/views/dashboards/globalFilter/addFilter';
import {FilterSelectorTrigger} from 'sentry/views/dashboards/globalFilter/filterSelectorTrigger';
import {
  buildNoValueFilterQuery,
  deriveFilterState,
  getFilterToken,
  NO_VALUE_SENTINEL,
  NO_VALUE_SUPPORTED_OPERATORS,
  operatorFromNoValueToken,
  parseFilterValue,
  stripUnsupportedNoValue,
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

export function FilterSelector({
  globalFilter,
  searchBarData,
  onRemoveFilter,
  onUpdateFilter,
  disableRemoveFilter,
}: FilterSelectorProps) {
  const {selection} = usePageFilters();

  // Ref to break the circular dependency: options need toggleOption, but toggleOption
  // comes from useStagedCompactSelect which depends on options.
  const toggleOptionRef = useRef<((val: string) => void) | undefined>(undefined);
  const stagedValueRef = useRef<string[]>([]);

  const {fieldDefinition, filterToken, noValueToken} = useMemo(
    () => deriveFilterState(globalFilter),
    [globalFilter]
  );

  // Effectively a filter token with a fallback to an empty placeholder when the filterToken is empty/has 'no value'.
  const pickerToken = useMemo(
    () => filterToken ?? getFilterToken({...globalFilter, value: ''}, fieldDefinition),
    [filterToken, globalFilter, fieldDefinition]
  );

  // Get initial selected values from the tokens
  const initialValues = useMemo(() => {
    const initialValue = filterToken ? getInitialInputValue(filterToken, true) : '';

    const selectedValues = getSelectedValuesFromText(initialValue);
    const values = selectedValues.map(item => item.value);

    if (noValueToken) {
      values.push(NO_VALUE_SENTINEL);
    }

    return values;
  }, [filterToken, noValueToken]);

  // Get operator info from the picker or no value token
  const {initialOperator, operatorDropdownItems} = useMemo(() => {
    if (!pickerToken) {
      return {
        initialOperator: TermOperator.DEFAULT,
        operatorDropdownItems: [],
      };
    }

    const operatorInfo = getOperatorInfo({filterToken: pickerToken, fieldDefinition});

    // The "(no value)" token has no value, so you can't derive an operator from getOperatorInfo.
    const noValueOperator =
      !filterToken && noValueToken ? operatorFromNoValueToken(noValueToken) : undefined;

    return {
      initialOperator: noValueOperator ?? operatorInfo?.operator ?? TermOperator.DEFAULT,
      operatorDropdownItems: (operatorInfo?.options ?? []).map(option => ({
        ...option,
        key: option.value,
        label: option.label,
        textValue: option.textValue,
        onClick: () => {
          setStagedOperator(option.value);
          // Deselect "(no value)" when switching to an unsupported operator.
          if (
            !NO_VALUE_SUPPORTED_OPERATORS.has(option.value) &&
            stagedValueRef.current.includes(NO_VALUE_SENTINEL)
          ) {
            toggleOptionRef.current?.(NO_VALUE_SENTINEL);
          }
        },
      })),
    };
  }, [pickerToken, filterToken, noValueToken, fieldDefinition]);

  const [stagedOperator, setStagedOperator] = useState(initialOperator);
  const [activeFilterValues, setActiveFilterValues] = useState(initialValues);
  const [stagedFilterValues, setStagedFilterValues] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    setActiveFilterValues(initialValues);
    setStagedFilterValues([]);
  }, [initialValues]);

  /**
   * Resync stagedOperator to the derived operator whenever the persisted
   * filter changes, because a stored has:/!has: clause only reconstructs
   * as is/is not — so the trigger must drop any stale contains/does not
   * contain it can't actually persist.
   */
  useEffect(() => {
    setStagedOperator(initialOperator);
  }, [initialOperator]);

  // Retrieve full tag definition to check if it has predefined values
  const datasetFilterKeys = searchBarData.getFilterKeys();
  const fullTag = datasetFilterKeys[globalFilter.tag.key];

  const canSelectMultipleValues = pickerToken
    ? tokenSupportsMultipleValues(pickerToken, datasetFilterKeys, fieldDefinition)
    : true;

  // Retrieve predefined values if the tag has any
  const predefinedValues = useMemo(() => {
    if (!pickerToken) {
      return null;
    }
    return getPredefinedValues({
      key: fullTag,
      filterValue: pickerToken.value.text,
      token: pickerToken,
      fieldDefinition,
    });
  }, [fullTag, pickerToken, fieldDefinition]);

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

  // eslint-disable-next-line @tanstack/query/exhaustive-deps
  const queryResult = useQuery({
    queryKey,
    queryFn: async ctx => {
      const result = await searchBarData.getTagValues({
        tag: ctx.queryKey[1],
        searchQuery: ctx.queryKey[3],
      });
      return result ?? [];
    },
    placeholderData: keepPreviousData,
    enabled: shouldFetchValues,
    staleTime: 5 * 60 * 1000,
  });

  const {data: fetchedFilterValues, isFetching} = queryResult;

  const options = useMemo((): Array<SelectOption<string>> => {
    const noValueOption: SelectOption<string> | null = NO_VALUE_SUPPORTED_OPERATORS.has(
      stagedOperator
    )
      ? {
          label: emptyValue,
          textValue: EMPTY_VALUE_LABEL,
          value: NO_VALUE_SENTINEL,
          ...(canSelectMultipleValues
            ? {
                leadingItems: ({isSelected}: {isSelected: boolean}) => (
                  <Checkbox
                    checked={isSelected}
                    onChange={() => toggleOptionRef.current?.(NO_VALUE_SENTINEL)}
                    aria-label={t('Select %s', EMPTY_VALUE_LABEL)}
                    tabIndex={-1}
                  />
                ),
              }
            : {}),
        }
      : null;

    const prependNoValueOption = (
      opts: Array<SelectOption<string>>
    ): Array<SelectOption<string>> => (noValueOption ? [noValueOption, ...opts] : opts);

    if (predefinedValues && !canSelectMultipleValues) {
      const predefinedOptions: Array<SelectOption<string>> = predefinedValues.flatMap(
        section =>
          section.suggestions.map(suggestion => ({
            label: suggestion.value,
            value: suggestion.value,
          }))
      );
      return prependNoValueOption(predefinedOptions);
    }

    const optionMap = new Map<string, SelectOption<string>>();
    const fixedOptionMap = new Map<string, SelectOption<string>>();
    const addOption = (value: string, map: Map<string, SelectOption<string>>) => {
      if (typeof value !== 'string') {
        Sentry.withScope(scope => {
          scope.setExtra('value', value);
          scope.setExtra('filterKey', globalFilter.tag.key);
          Sentry.captureException(
            new Error('Dashboard filter addOption received a non-string value')
          );
        });
        return;
      }
      const option: SelectOption<string> = {
        label: middleEllipsis(value, 70, /[\s-_:]/),
        value,
        textValue: value,
      };

      // Only add checkboxes for multi-select mode
      if (canSelectMultipleValues) {
        option.leadingItems = ({isSelected}: {isSelected: boolean}) => (
          <Checkbox
            checked={isSelected}
            onChange={() => toggleOptionRef.current?.(value)}
            aria-label={t('Select %s', value)}
            tabIndex={-1}
          />
        );
      }

      return map.set(value, option);
    };

    activeFilterValues
      .filter(value => value !== NO_VALUE_SENTINEL)
      .forEach(value => addOption(value, optionMap));

    // Predefined values
    predefinedValues?.forEach(suggestionSection => {
      suggestionSection.suggestions.forEach(suggestion =>
        addOption(suggestion.value, optionMap)
      );
    });
    // Filter values fetched using getTagValues
    fetchedFilterValues?.forEach(value =>
      addOption(typeof value === 'string' ? value : value.value, optionMap)
    );

    // Allow setting a custom filter value based on search input
    if (searchQuery && !optionMap.has(searchQuery)) {
      addOption(searchQuery, fixedOptionMap);
    }
    // Staged filter values inside the filter selector
    stagedFilterValues.forEach(value => {
      if (value !== NO_VALUE_SENTINEL && !optionMap.has(value)) {
        addOption(value, fixedOptionMap);
      }
    });
    return prependNoValueOption([...fixedOptionMap.values(), ...optionMap.values()]);
  }, [
    fetchedFilterValues,
    predefinedValues,
    activeFilterValues,
    stagedFilterValues,
    searchQuery,
    canSelectMultipleValues,
    globalFilter.tag.key,
    stagedOperator,
  ]);

  const translatedOptions = translateKnownFilterOptions(options, globalFilter);

  const handleChange = (rawOpts: string[]) => {
    const opts = stripUnsupportedNoValue(rawOpts, stagedOperator);

    if (isEqual(opts, activeFilterValues) && stagedOperator === initialOperator) {
      return;
    }
    if (!pickerToken) {
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

    const includeNoValue = opts.includes(NO_VALUE_SENTINEL);
    const valueOpts = opts.filter(opt => opt !== NO_VALUE_SENTINEL);

    let valueQuery = '';
    if (valueOpts.length > 0) {
      const cleanedValue = prepareInputValueForSaving(
        getFilterValueType(pickerToken, fieldDefinition),
        valueOpts
          .map(opt => escapeTagValueForSearch(opt, {allowArrayValue: false}))
          .join(',')
      );
      const isolatedToken = parseFilterValue(pickerToken.text, globalFilter)[0];
      const valueToRewrite = isolatedToken ?? pickerToken;
      // Always rebuild the token with the operator the UI is showing.
      // The synthetic placeholder token used for "(no value)" defaults to the string
      // CONTAINS wildcard, so patching only the value would leak that operator.
      valueQuery = modifyFilterValue(
        valueToRewrite.text,
        valueToRewrite,
        cleanedValue,
        stagedOperator
      );
    }

    const newValue = includeNoValue
      ? buildNoValueFilterQuery(globalFilter.tag.key, stagedOperator, valueQuery)
      : valueQuery;

    onUpdateFilter({
      ...globalFilter,
      value: newValue,
    });
  };

  const hasOperatorChanges =
    stagedFilterValues.length > 0 && stagedOperator !== initialOperator;

  const stagedSelect = useStagedCompactSelect({
    value: activeFilterValues,
    options: translatedOptions,
    onChange: handleChange,
    onStagedValueChange: setStagedFilterValues,
    multiple: true,
    hasExternalChanges: hasOperatorChanges,
  });

  // Wire up refs after stagedSelect is created to break the circular
  // dependency between options (which need toggleOption) and useStagedCompactSelect
  // (which needs options).
  toggleOptionRef.current = stagedSelect.toggleOption;
  stagedValueRef.current = stagedSelect.value;

  const {dispatch} = stagedSelect;
  const hasStagedChanges =
    xor(stagedSelect.value, activeFilterValues).length > 0 || hasOperatorChanges;

  const renderFilterSelectorTrigger = (filterValues: string[]) => {
    const displayValues = stripUnsupportedNoValue(filterValues, stagedOperator);

    return (
      <FilterSelectorTrigger
        globalFilter={globalFilter}
        activeFilterValues={displayValues}
        operator={stagedOperator}
        options={translatedOptions}
      />
    );
  };

  const loadingFooter = isFetching ? (
    <Flex justify="center" padding="xs">
      <FooterLoadingIndicator size={14} />
    </Flex>
  ) : null;

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
        menuFooter={loadingFooter}
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
    <CompactSelect
      mode="grid"
      multiple
      {...stagedSelect.compactSelectProps}
      search={{
        placeholder: t('Search or enter a custom value...'),
        onChange: (searchValue: string) => {
          dispatch({type: 'set search', search: searchValue});
          setSearchQuery(searchValue);
        },
      }}
      disabled={false}
      sizeLimit={30}
      onClose={() => {
        setSearchQuery('');
        setStagedFilterValues(stagedSelect.value);
        setStagedOperator(initialOperator);
      }}
      sizeLimitMessage={t('Use search to find more filter values…')}
      emptyMessage={
        isFetching ? t('Loading filter values...') : t('No filter values found')
      }
      menuFooter={
        hasStagedChanges || isFetching ? (
          <Stack gap="md">
            {loadingFooter}
            {hasStagedChanges && (
              <Flex gap="md" align="center" justify="end">
                <MenuComponents.CancelButton
                  onClick={() => dispatch({type: 'remove staged'})}
                />
                <MenuComponents.ApplyButton
                  onClick={() => {
                    dispatch({type: 'remove staged'});
                    handleChange(stagedSelect.value);
                  }}
                />
              </Flex>
            )}
          </Stack>
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
                  <Button {...triggerProps} size="zero" variant="transparent">
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
          {renderFilterSelectorTrigger(activeFilterValues)}
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
    return options.map(option => {
      const translatedLabel =
        subregionCodeToName[option.value as SubregionCode] || option.label;
      return {
        ...option,
        label: translatedLabel,
        textValue:
          typeof translatedLabel === 'string' ? translatedLabel : option.textValue,
      };
    });
  }
  return options;
};

export const MenuTitleWrapper = styled('span')`
  display: inline-block;
  padding-top: ${p => p.theme.space.xs};
  padding-bottom: ${p => p.theme.space.xs};
`;

const FooterLoadingIndicator = styled(LoadingIndicator)`
  && {
    margin: 0;
  }
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

const FilterValueTruncated = styled('div')`
  display: block;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 300px;
  width: min-content;
`;
