import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Input} from '@sentry/scraps/input';
import {Flex} from '@sentry/scraps/layout';

import {Button} from 'sentry/components/core/button';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {getOperatorInfo} from 'sentry/components/searchQueryBuilder/tokens/filter/filterOperator';
import {OP_LABELS} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import {TermOperator} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {getDatasetLabel} from 'sentry/views/dashboards/globalFilter/addFilter';
import type {GenericFilterSelectorProps} from 'sentry/views/dashboards/globalFilter/genericFilterSelector';
import NumericFilterSelectorTrigger from 'sentry/views/dashboards/globalFilter/numericFilterSelectorTrigger';
import {
  getFieldDefinitionForDataset,
  isValidNumericFilterValue,
  newNumericFilterQuery,
  parseFilterValue,
} from 'sentry/views/dashboards/globalFilter/utils';

function NumericFilterSelector({
  globalFilter,
  searchBarData,
  onRemoveFilter,
  onUpdateFilter,
}: GenericFilterSelectorProps) {
  const filterKeys = useMemo(() => searchBarData.getFilterKeys(), [searchBarData]);

  // Parse global filter condition to retrieve initial state
  const globalFilterTokens = useMemo(
    () => parseFilterValue(globalFilter.value, filterKeys, globalFilter),
    [filterKeys, globalFilter]
  );

  const globalFilterToken = globalFilterTokens ? globalFilterTokens[0] : null;

  const {operator: globalFilterOperator, options} = useMemo(
    () =>
      globalFilterToken
        ? getOperatorInfo({
            filterToken: globalFilterToken,
            hasWildcardOperators: false,
            fieldDefinition: getFieldDefinitionForDataset(
              globalFilter.tag,
              globalFilter.dataset
            ),
          })
        : {
            operator: TermOperator.EQUAL,
            options: [],
          },
    [globalFilterToken, globalFilter.tag, globalFilter.dataset]
  );

  const [stagedFilterOperator, setStagedFilterOperator] =
    useState<TermOperator>(globalFilterOperator);
  const [stagedFilterValue, setStagedFilterValue] = useState<string>(
    globalFilterToken?.value?.text || ''
  );

  const hasStagedChanges =
    stagedFilterOperator !== globalFilterOperator ||
    stagedFilterValue !== globalFilterToken?.value?.text;

  return (
    <CompactSelect
      disabled={false}
      value=""
      options={[]}
      hideOptions
      onChange={() => {}}
      onClose={() => {
        setStagedFilterOperator(globalFilterOperator);
        setStagedFilterValue(globalFilterToken?.value?.text || '');
      }}
      menuTitle={t('%s Filter', getDatasetLabel(globalFilter.dataset))}
      menuHeaderTrailingItems={() => (
        <StyledButton
          aria-label={t('Remove Filter')}
          size="zero"
          onClick={() => onRemoveFilter(globalFilter)}
        >
          {t('Remove Filter')}
        </StyledButton>
      )}
      menuBody={
        <MenuBodyWrap>
          <Flex gap="xs">
            <DropdownMenu
              usePortal
              trigger={triggerProps => (
                <StyledOperatorButton {...triggerProps}>
                  {OP_LABELS[stagedFilterOperator]}
                </StyledOperatorButton>
              )}
              items={options.map(option => ({
                textValue: option.textValue,
                label: option.label,
                key: option.value,
                onClick: () => {
                  setStagedFilterOperator(option.value);
                },
              }))}
            />
            <Input
              aria-label={t('Filter value')}
              value={stagedFilterValue}
              onChange={e => {
                setStagedFilterValue(e.target.value);
              }}
            />
          </Flex>
        </MenuBodyWrap>
      }
      triggerProps={{
        children: (
          <NumericFilterSelectorTrigger
            globalFilter={globalFilter}
            globalFilterOperator={globalFilterOperator}
            globalFilterValue={globalFilterToken?.value?.text || ''}
          />
        ),
      }}
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
                    disabled={
                      !globalFilterToken ||
                      !isValidNumericFilterValue(
                        stagedFilterValue,
                        globalFilterToken,
                        globalFilter
                      )
                    }
                    onClick={() => {
                      if (!globalFilterToken) return;
                      const newFilterQuery = newNumericFilterQuery(
                        stagedFilterValue,
                        stagedFilterOperator,
                        globalFilterToken,
                        filterKeys,
                        globalFilter
                      );
                      onUpdateFilter({
                        ...globalFilter,
                        value: newFilterQuery,
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
  margin: 4px;
`;

const FooterWrap = styled('div')`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(2)};

  /* If there's FooterMessage above */
  &:not(:first-child) {
    margin-top: ${space(1)};
  }
`;
const FooterInnerWrap = styled('div')`
  grid-row: -1;
  display: grid;
  grid-auto-flow: column;
  gap: ${space(1)};
  justify-self: end;
  justify-items: end;

  &:empty {
    display: none;
  }
`;

const StyledOperatorButton = styled(Button)`
  width: 40%;
`;

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
