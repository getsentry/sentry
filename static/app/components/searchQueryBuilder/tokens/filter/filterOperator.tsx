import {type ReactNode, useMemo} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';
import {mergeProps} from '@react-aria/utils';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import {CompactSelect, type SelectOption} from 'sentry/components/core/compactSelect';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Tooltip} from 'sentry/components/core/tooltip';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {UnstyledButton} from 'sentry/components/searchQueryBuilder/tokens/filter/unstyledButton';
import {useFilterButtonProps} from 'sentry/components/searchQueryBuilder/tokens/filter/useFilterButtonProps';
import {
  DATE_OP_LABELS,
  DATE_OPTIONS,
  getLabelAndOperatorFromToken,
  getValidOpsForFilter,
  OP_LABELS,
} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import {type SearchQueryBuilderOperators} from 'sentry/components/searchQueryBuilder/types';
import {
  isDateToken,
  recentSearchTypeToLabel,
} from 'sentry/components/searchQueryBuilder/utils';
import {
  FilterType,
  type ParseResultToken,
  TermOperator,
  type Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {getKeyName} from 'sentry/components/searchSyntax/utils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

interface FilterOperatorProps {
  item: Node<ParseResultToken>;
  onOpenChange: (isOpen: boolean) => void;
  state: ListState<ParseResultToken>;
  token: TokenResult<Token.FILTER>;
}

const MENU_OFFSET: [number, number] = [0, 12];

function getOperatorFromDateToken(token: TokenResult<Token.FILTER>) {
  switch (token.filter) {
    case FilterType.DATE:
    case FilterType.SPECIFIC_DATE:
      return token.operator;
    case FilterType.RELATIVE_DATE:
      return token.value.sign === '+'
        ? TermOperator.LESS_THAN
        : TermOperator.GREATER_THAN;
    default:
      return TermOperator.DEFAULT;
  }
}

function FilterKeyOperatorLabel({
  keyValue,
  keyLabel,
  opLabel,
  includeKeyLabel,
}: {
  keyLabel: string;
  keyValue: string;
  includeKeyLabel?: boolean;
  opLabel?: string;
}) {
  const {getFieldDefinition} = useSearchQueryBuilder();
  const fieldDefinition = getFieldDefinition(keyValue);

  if (!includeKeyLabel) {
    return <OpLabel>{opLabel}</OpLabel>;
  }

  return (
    <KeyOpLabelWrapper>
      <Tooltip title={fieldDefinition?.desc}>
        <span>{keyLabel}</span>
        {opLabel ? <OpLabel> {opLabel}</OpLabel> : null}
      </Tooltip>
    </KeyOpLabelWrapper>
  );
}

export function getOperatorInfo(
  token: TokenResult<Token.FILTER>,
  hasWildcardOperators: boolean
): {
  label: ReactNode;
  operator: SearchQueryBuilderOperators;
  options: Array<SelectOption<SearchQueryBuilderOperators>>;
} {
  if (isDateToken(token)) {
    const operator = getOperatorFromDateToken(token);
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    const opLabel = DATE_OP_LABELS[operator] ?? operator;

    return {
      operator,
      label: <OpLabel>{opLabel}</OpLabel>,
      options: DATE_OPTIONS.map((op): SelectOption<SearchQueryBuilderOperators> => {
        const optionOpLabel = DATE_OP_LABELS[op] ?? op;

        return {
          value: op,
          textValue: optionOpLabel,
          label: <OpLabel>{optionOpLabel}</OpLabel>,
        };
      }),
    };
  }

  const {operator, label} = getLabelAndOperatorFromToken(token, hasWildcardOperators);

  if (token.filter === FilterType.IS) {
    return {
      operator,
      label: (
        <FilterKeyOperatorLabel
          keyValue={token.key.value}
          keyLabel={token.key.text}
          opLabel={operator === TermOperator.NOT_EQUAL ? 'not' : undefined}
          includeKeyLabel
        />
      ),
      options: [
        {
          value: TermOperator.DEFAULT,
          label: (
            <FilterKeyOperatorLabel
              keyLabel={token.key.text}
              keyValue={token.key.value}
              includeKeyLabel
            />
          ),
          textValue: 'is',
        },
        {
          value: TermOperator.NOT_EQUAL,
          label: (
            <FilterKeyOperatorLabel
              keyLabel={token.key.text}
              keyValue={token.key.value}
              opLabel="not"
              includeKeyLabel
            />
          ),
          textValue: 'is not',
        },
      ],
    };
  }

  if (token.filter === FilterType.HAS) {
    return {
      operator,
      label: (
        <FilterKeyOperatorLabel
          keyValue={token.key.value}
          keyLabel={operator === TermOperator.NOT_EQUAL ? 'does not have' : 'has'}
          includeKeyLabel
        />
      ),
      options: [
        {
          value: TermOperator.DEFAULT,
          label: (
            <FilterKeyOperatorLabel
              keyLabel="has"
              keyValue={token.key.value}
              includeKeyLabel
            />
          ),
          textValue: 'has',
        },
        {
          value: TermOperator.NOT_EQUAL,
          label: (
            <FilterKeyOperatorLabel
              keyLabel="does not have"
              keyValue={token.key.value}
              includeKeyLabel
            />
          ),
          textValue: 'does not have',
        },
      ],
    };
  }

  const keyLabel = token.key.text;

  return {
    operator,
    label: <OpLabel>{label}</OpLabel>,
    options: getValidOpsForFilter(token, hasWildcardOperators)
      .filter(op => op !== TermOperator.EQUAL)
      .map((op): SelectOption<SearchQueryBuilderOperators> => {
        const optionOpLabel = OP_LABELS[op] ?? op;

        return {
          value: op,
          label: <OpLabel>{optionOpLabel}</OpLabel>,
          textValue: `${keyLabel} ${optionOpLabel}`,
        };
      }),
  };
}

export function FilterOperator({state, item, token, onOpenChange}: FilterOperatorProps) {
  const organization = useOrganization();
  const {dispatch, searchSource, query, recentSearches, disabled} =
    useSearchQueryBuilder();
  const filterButtonProps = useFilterButtonProps({state, item});

  const hasWildcardOperators = organization.features.includes(
    'search-query-builder-wildcard-operators'
  );

  const {operator, label, options} = useMemo(
    () => getOperatorInfo(token, hasWildcardOperators),
    [token, hasWildcardOperators]
  );

  const onlyOperator = token.filter === FilterType.IS || token.filter === FilterType.HAS;

  return (
    <CompactSelect
      disabled={disabled}
      trigger={triggerProps => (
        <OpButton
          disabled={disabled}
          aria-label={t('Edit operator for filter: %s', token.key.text)}
          onlyOperator={onlyOperator}
          {...mergeProps(triggerProps, filterButtonProps)}
        >
          <InteractionStateLayer />
          {label}
        </OpButton>
      )}
      size="sm"
      options={options}
      value={operator}
      onOpenChange={onOpenChange}
      onChange={option => {
        trackAnalytics('search.operator_autocompleted', {
          organization,
          query,
          search_type: recentSearchTypeToLabel(recentSearches),
          search_source: searchSource,
          new_experience: true,
          search_operator: option.value,
          filter_key: getKeyName(token.key),
        });
        dispatch({
          type: 'UPDATE_FILTER_OP',
          token,
          op: option.value,
        });
      }}
      offset={MENU_OFFSET}
    />
  );
}

const OpButton = styled(UnstyledButton, {
  shouldForwardProp: isPropValid,
})<{onlyOperator?: boolean}>`
  padding: 0 ${space(0.25)} 0 ${space(0.5)};
  height: 100%;
  border-left: 1px solid transparent;
  border-right: 1px solid transparent;

  border-radius: ${p => (p.onlyOperator ? '3px 0 0 3px' : 0)};

  :focus {
    background-color: ${p => p.theme.translucentGray100};
    border-right: 1px solid ${p => p.theme.innerBorder};
    border-left: 1px solid ${p => p.theme.innerBorder};
  }
`;

const KeyOpLabelWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.75)};
`;

const OpLabel = styled('span')`
  color: ${p => p.theme.subText};
`;
