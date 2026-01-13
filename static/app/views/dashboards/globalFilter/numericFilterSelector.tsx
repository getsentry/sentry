import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {CompactSelect, type SelectOption} from '@sentry/scraps/compactSelect';
import {SelectTrigger} from '@sentry/scraps/compactSelect/trigger';
import {Input} from '@sentry/scraps/input';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Button} from 'sentry/components/core/button';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {getOperatorInfo} from 'sentry/components/searchQueryBuilder/tokens/filter/filterOperator';
import {OP_LABELS as NATIVE_OP_LABELS} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import {
  TermOperator,
  Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';
import {getDatasetLabel} from 'sentry/views/dashboards/globalFilter/addFilter';
import {MenuTitleWrapper} from 'sentry/views/dashboards/globalFilter/filterSelector';
import type {GenericFilterSelectorProps} from 'sentry/views/dashboards/globalFilter/genericFilterSelector';
import {
  BetweenFilterSelectorTrigger,
  NumericFilterSelectorTrigger,
} from 'sentry/views/dashboards/globalFilter/numericFilterSelectorTrigger';
import {
  getFieldDefinitionForDataset,
  isValidNumericFilterValue,
  newNumericFilterQuery,
  parseFilterValue,
} from 'sentry/views/dashboards/globalFilter/utils';
import type {GlobalFilter} from 'sentry/views/dashboards/types';

enum CustomOperator {
  BETWEEN = 'between',
}
type Operator = TermOperator | CustomOperator;

const OPERATOR_LABELS: Partial<Record<Operator, string>> = {
  [CustomOperator.BETWEEN]: t('between'),
  [TermOperator.GREATER_THAN_EQUAL]: '\u2265',
  [TermOperator.LESS_THAN_EQUAL]: '\u2264',
};

export function getOperatorLabel(operator: Operator): string {
  return OPERATOR_LABELS[operator] ?? NATIVE_OP_LABELS[operator as TermOperator];
}

const FILTER_QUERY_SEPARATOR = ' ';

interface NumericFilterState {
  buildFilterQuery: () => string;
  hasStagedChanges: boolean;
  isValidValue: boolean;
  operatorOptions: Array<SelectOption<Operator>>;
  renderInputField: () => React.ReactNode;
  renderSelectorTrigger: () => React.JSX.Element;
  resetValues: () => void;
  setStagedOperator: (operator: TermOperator) => void;
  setStagedValue: (value: string) => void;
  stagedOperator: Operator;
  stagedValue: string;
}

function useNativeOperatorFilter(
  globalFilterToken: TokenResult<Token.FILTER> | undefined,
  globalFilter: GlobalFilter
): NumericFilterState {
  // Initial values of the filter
  const globalFilterValue = globalFilterToken?.value?.text ?? '';
  const operatorInfo = useMemo(
    () =>
      globalFilterToken &&
      getOperatorInfo({
        filterToken: globalFilterToken,
        fieldDefinition: getFieldDefinitionForDataset(
          globalFilter.tag,
          globalFilter.dataset
        ),
      }),
    [globalFilterToken, globalFilter.tag, globalFilter.dataset]
  );
  const globalFilterOperator = operatorInfo?.operator ?? TermOperator.EQUAL;

  // Staged values of the filter
  const [stagedFilterOperator, setStagedFilterOperator] =
    useState<TermOperator>(globalFilterOperator);
  const [stagedFilterValue, setStagedFilterValue] = useState<string>(globalFilterValue);

  const hasStagedChanges =
    stagedFilterOperator !== globalFilterOperator ||
    stagedFilterValue !== globalFilterValue;

  const renderInputField = () => {
    return (
      <StyledInput
        aria-label="Filter value"
        value={stagedFilterValue}
        onChange={e => {
          setStagedFilterValue(e.target.value);
        }}
      />
    );
  };

  const renderSelectorTrigger = () => {
    return (
      <NumericFilterSelectorTrigger
        globalFilter={globalFilter}
        globalFilterOperator={stagedFilterOperator}
        globalFilterValue={stagedFilterValue}
      />
    );
  };

  const isValidValue =
    !!globalFilterToken &&
    isValidNumericFilterValue(stagedFilterValue, globalFilterToken, globalFilter);

  const buildFilterQuery = () => {
    if (!globalFilterToken) return '';

    return newNumericFilterQuery(
      stagedFilterValue,
      stagedFilterOperator,
      globalFilterToken,
      globalFilter
    );
  };

  const resetValues = () => {
    setStagedFilterOperator(globalFilterOperator);
    setStagedFilterValue(globalFilterValue);
  };

  return {
    operatorOptions: operatorInfo?.options ?? [],
    stagedOperator: stagedFilterOperator,
    setStagedOperator: setStagedFilterOperator,
    stagedValue: stagedFilterValue,
    setStagedValue: setStagedFilterValue,
    resetValues,
    hasStagedChanges,
    renderInputField,
    renderSelectorTrigger,
    isValidValue,
    buildFilterQuery,
  };
}

function useBetweenOperatorFilter(
  globalFilterTokens: Array<TokenResult<Token.FILTER>>,
  globalFilter: GlobalFilter
): NumericFilterState {
  const lowerBound = useNativeOperatorFilter(globalFilterTokens?.[0], globalFilter);
  const upperBound = useNativeOperatorFilter(globalFilterTokens?.[1], globalFilter);

  const renderInputField = () => {
    return (
      <Flex gap="sm" align="center">
        {lowerBound.renderInputField()}
        <Text>{t('and')}</Text>
        {upperBound.renderInputField()}
      </Flex>
    );
  };

  const renderSelectorTrigger = () => {
    return (
      <BetweenFilterSelectorTrigger
        globalFilter={globalFilter}
        lowerBound={lowerBound.stagedValue}
        upperBound={upperBound.stagedValue}
      />
    );
  };

  const isValidValue = lowerBound.isValidValue && upperBound.isValidValue;

  const resetValues = () => {
    lowerBound.resetValues();
    upperBound.resetValues();
  };

  return {
    operatorOptions: [] as Array<SelectOption<Operator>>,
    stagedOperator: CustomOperator.BETWEEN,
    setStagedOperator: () => {},
    stagedValue: '',
    setStagedValue: () => {},
    resetValues,
    hasStagedChanges: lowerBound.hasStagedChanges || upperBound.hasStagedChanges,
    renderInputField,
    renderSelectorTrigger,
    isValidValue,
    buildFilterQuery: () =>
      lowerBound.buildFilterQuery() +
      FILTER_QUERY_SEPARATOR +
      upperBound.buildFilterQuery(),
  };
}

function NumericFilterSelector({
  globalFilter,
  onRemoveFilter,
  onUpdateFilter,
  disableRemoveFilter,
}: GenericFilterSelectorProps) {
  const globalFilterQueries = useMemo(
    () => globalFilter.value.split(FILTER_QUERY_SEPARATOR),
    [globalFilter]
  );

  const isNativeOperator = globalFilterQueries.length === 1;
  const [stagedIsNativeOperator, setStagedIsNativeOperator] = useState(isNativeOperator);

  const nativeFilterToken = useMemo(() => {
    if (isNativeOperator) {
      const firstQuery = globalFilterQueries[0] ?? '';
      const tokens = parseFilterValue(firstQuery, globalFilter);
      return tokens?.[0];
    }
    const tokens = parseFilterValue(`${globalFilter.tag.key}:>100`, globalFilter);
    return tokens?.[0];
  }, [globalFilter, globalFilterQueries, isNativeOperator]);

  const betweenFilterTokens = useMemo(() => {
    const defaultBetweenQueries = [
      `${globalFilter.tag.key}:>=0`,
      `${globalFilter.tag.key}:<=100`,
    ];
    const [lowerBoundQuery, upperBoundQuery] =
      globalFilterQueries.length === 2 ? globalFilterQueries : defaultBetweenQueries;

    if (!lowerBoundQuery || !upperBoundQuery) {
      return [];
    }
    // Parse queries separately to avoid token location issues
    const lowerBoundToken = parseFilterValue(lowerBoundQuery, {
      ...globalFilter,
      value: lowerBoundQuery,
    });
    const upperBoundToken = parseFilterValue(upperBoundQuery, {
      ...globalFilter,
      value: upperBoundQuery,
    });
    return [...lowerBoundToken, ...upperBoundToken];
  }, [globalFilter, globalFilterQueries]);

  const nativeFilter = useNativeOperatorFilter(nativeFilterToken, globalFilter);
  const betweenFilter = useBetweenOperatorFilter(betweenFilterTokens, globalFilter);

  const filter = stagedIsNativeOperator ? nativeFilter : betweenFilter;
  const hasStagedChanges =
    filter.hasStagedChanges || stagedIsNativeOperator !== isNativeOperator;

  const operatorOptions = [
    ...nativeFilter.operatorOptions,
    {
      value: CustomOperator.BETWEEN,
    },
  ];

  const operatorItems = operatorOptions.map(option => ({
    ...option,
    key: option.value,
    label: getOperatorLabel(option.value),
    textValue: getOperatorLabel(option.value),
    onClick: () => {
      if (option.value === CustomOperator.BETWEEN) {
        setStagedIsNativeOperator(false);
      } else {
        setStagedIsNativeOperator(true);
        nativeFilter.setStagedOperator(option.value);
      }
    },
  }));

  return (
    <CompactSelect
      disabled={false}
      value=""
      options={[]}
      hideOptions
      onChange={() => {}}
      onClose={() => {
        filter.resetValues();
        setStagedIsNativeOperator(isNativeOperator);
      }}
      menuTitle={
        <MenuTitleWrapper>
          {t('%s Filter', getDatasetLabel(globalFilter.dataset))}
        </MenuTitleWrapper>
      }
      menuHeaderTrailingItems={
        disableRemoveFilter
          ? undefined
          : () => (
              <StyledButton
                aria-label={t('Remove Filter')}
                size="zero"
                onClick={() => onRemoveFilter(globalFilter)}
              >
                {t('Remove Filter')}
              </StyledButton>
            )
      }
      menuBody={
        <MenuBodyWrap>
          <Flex gap="xs" direction="column">
            <DropdownMenu
              usePortal
              trigger={triggerProps => (
                <StyledOperatorButton {...triggerProps}>
                  {getOperatorLabel(filter.stagedOperator)}
                </StyledOperatorButton>
              )}
              items={operatorItems}
            />
            {filter.renderInputField()}
          </Flex>
        </MenuBodyWrap>
      }
      trigger={triggerProps => (
        <SelectTrigger.Button {...triggerProps}>
          {filter.renderSelectorTrigger()}
        </SelectTrigger.Button>
      )}
      menuFooter={
        hasStagedChanges
          ? ({closeOverlay}: any) => (
              <FooterWrap>
                <FooterInnerWrap>
                  <Button borderless size="xs" onClick={closeOverlay}>
                    {t('Cancel')}
                  </Button>
                  <Button
                    size="xs"
                    priority="primary"
                    disabled={!filter.isValidValue}
                    onClick={() => {
                      onUpdateFilter({
                        ...globalFilter,
                        value: filter.buildFilterQuery(),
                      });
                      closeOverlay();
                    }}
                  >
                    {t('Apply')}
                  </Button>
                </FooterInnerWrap>
              </FooterWrap>
            )
          : null
      }
    />
  );
}

export default NumericFilterSelector;

const MenuBodyWrap = styled('div')`
  padding: ${p => p.theme.space.md};
`;

const FooterWrap = styled('div')`
  display: grid;
  grid-auto-flow: column;
  gap: ${p => p.theme.space.xl};

  /* If there's FooterMessage above */
  &:not(:first-child) {
    margin-top: ${p => p.theme.space.md};
  }
`;
const FooterInnerWrap = styled('div')`
  grid-row: -1;
  display: grid;
  grid-auto-flow: column;
  gap: ${p => p.theme.space.md};
  justify-self: end;
  justify-items: end;

  &:empty {
    display: none;
  }
`;

const StyledOperatorButton = styled(Button)`
  width: 100%;
  font-weight: ${p => p.theme.fontWeight.normal};
`;

const StyledButton = styled(Button)`
  font-size: inherit;
  font-weight: ${p => p.theme.fontWeight.normal};
  color: ${p => p.theme.tokens.content.secondary};
  padding: 0 ${p => p.theme.space.xs};
  margin: -${p => p.theme.space.xs} -${p => p.theme.space.xs};
`;

const StyledInput = styled(Input)`
  text-align: center;
`;
