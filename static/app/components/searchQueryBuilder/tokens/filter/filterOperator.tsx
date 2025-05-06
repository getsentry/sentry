import {type ReactNode, useMemo} from 'react';
import styled from '@emotion/styled';
import {mergeProps} from '@react-aria/utils';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import {CompactSelect, type SelectOption} from 'sentry/components/core/compactSelect';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {UnstyledButton} from 'sentry/components/searchQueryBuilder/tokens/filter/unstyledButton';
import {useFilterButtonProps} from 'sentry/components/searchQueryBuilder/tokens/filter/useFilterButtonProps';
import {getValidOpsForFilter} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import {TermOperatorNew} from 'sentry/components/searchQueryBuilder/types';
import {
  isDateToken,
  recentSearchTypeToLabel,
} from 'sentry/components/searchQueryBuilder/utils';
import {
  FilterType,
  type ParseResultToken,
  Token,
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

const OP_LABELS = {
  [TermOperatorNew.DEFAULT]: 'is',
  [TermOperatorNew.GREATER_THAN]: '>',
  [TermOperatorNew.GREATER_THAN_EQUAL]: '>=',
  [TermOperatorNew.LESS_THAN]: '<',
  [TermOperatorNew.LESS_THAN_EQUAL]: '<=',
  [TermOperatorNew.NOT_EQUAL]: 'is not',
  [TermOperatorNew.CONTAINS]: 'contains',
};

const DATE_OP_LABELS = {
  [TermOperatorNew.GREATER_THAN]: 'is after',
  [TermOperatorNew.GREATER_THAN_EQUAL]: 'is on or after',
  [TermOperatorNew.LESS_THAN]: 'is before',
  [TermOperatorNew.LESS_THAN_EQUAL]: 'is on or before',
  [TermOperatorNew.EQUAL]: 'is',
  [TermOperatorNew.DEFAULT]: 'is',
};

const DATE_OPTIONS: TermOperatorNew[] = [
  TermOperatorNew.GREATER_THAN,
  TermOperatorNew.GREATER_THAN_EQUAL,
  TermOperatorNew.LESS_THAN,
  TermOperatorNew.LESS_THAN_EQUAL,
  TermOperatorNew.EQUAL,
];

function getOperatorFromDateToken(token: TokenResult<Token.FILTER>) {
  switch (token.filter) {
    case FilterType.DATE:
    case FilterType.SPECIFIC_DATE:
      return token.operator as unknown as TermOperatorNew;
    case FilterType.RELATIVE_DATE:
      return token.value.sign === '+'
        ? TermOperatorNew.LESS_THAN
        : TermOperatorNew.GREATER_THAN;
    default:
      return TermOperatorNew.DEFAULT;
  }
}

function getTermOperatorFromToken(token: TokenResult<Token.FILTER>): TermOperatorNew {
  if (token.negated) {
    return TermOperatorNew.NOT_EQUAL;
  }

  return token.operator as unknown as TermOperatorNew;
}

function FilterKeyOperatorLabel({
  keyLabel,
  opLabel,
  includeKeyLabel,
}: {
  includeKeyLabel?: boolean;
  keyLabel?: string;
  opLabel?: string;
}) {
  if (!includeKeyLabel) {
    return <OpLabel>{opLabel}</OpLabel>;
  }

  return (
    <KeyOpLabelWrapper>
      <span>{keyLabel}</span>
      {opLabel ? <OpLabel> {opLabel}</OpLabel> : null}
    </KeyOpLabelWrapper>
  );
}

export function getOperatorInfo(token: TokenResult<Token.FILTER>): {
  label: ReactNode;
  operator: TermOperatorNew;
  options: Array<SelectOption<TermOperatorNew>>;
} {
  if (isDateToken(token)) {
    const operator = getOperatorFromDateToken(token);
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    const opLabel = DATE_OP_LABELS[operator] ?? operator;

    return {
      operator,
      label: <OpLabel>{opLabel}</OpLabel>,
      options: DATE_OPTIONS.map((op): SelectOption<TermOperatorNew> => {
        // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        const optionOpLabel = DATE_OP_LABELS[op] ?? op;

        return {
          value: op,
          textValue: optionOpLabel,
          label: <OpLabel>{optionOpLabel}</OpLabel>,
        };
      }),
    };
  }

  const operator = getTermOperatorFromToken(token);

  if (token.filter === FilterType.IS) {
    return {
      operator,
      label: (
        <FilterKeyOperatorLabel
          keyLabel={token.key.text}
          opLabel={operator === TermOperatorNew.NOT_EQUAL ? 'not' : undefined}
          includeKeyLabel
        />
      ),
      options: [
        {
          value: TermOperatorNew.DEFAULT,
          label: <FilterKeyOperatorLabel keyLabel={token.key.text} includeKeyLabel />,
          textValue: 'is',
        },
        {
          value: TermOperatorNew.NOT_EQUAL,
          label: (
            <FilterKeyOperatorLabel
              keyLabel={token.key.text}
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
          keyLabel={operator === TermOperatorNew.NOT_EQUAL ? 'does not have' : 'has'}
          includeKeyLabel
        />
      ),
      options: [
        {
          value: TermOperatorNew.DEFAULT,
          label: <FilterKeyOperatorLabel keyLabel="has" includeKeyLabel />,
          textValue: 'has',
        },
        {
          value: TermOperatorNew.NOT_EQUAL,
          label: <FilterKeyOperatorLabel keyLabel="does not have" includeKeyLabel />,
          textValue: 'does not have',
        },
      ],
    };
  }

  // make new enum that contains all the operators and the new ones
  // change all the places that accept the old enum to use the new one
  // add contains to the special case for text (here)
  // change the reducer (modifyFilterOperator in useQueryBuilderState) to use the new enum
  // if the value is contains do things (i.e. wrap in the stars)
  // if the value is wrapped in stars parse it out and switch to the `contains` operator from `is` operator

  const keyLabel = token.key.text;
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const opLabel = OP_LABELS[operator] ?? operator;

  // special case for text, and add in contains option
  if (token.filter === FilterType.TEXT || token.filter === FilterType.TEXT_IN) {
    let isContains = false;
    if (token.value.type === Token.VALUE_TEXT) {
      isContains = token.value.contains;
    } else if (token.value.type === Token.VALUE_TEXT_LIST) {
      isContains = token.value.items.every(item => item.value?.contains);
    }

    return {
      operator,
      label: isContains ? <OpLabel>contains</OpLabel> : <OpLabel>{opLabel}</OpLabel>,
      options: [
        {
          value: TermOperatorNew.DEFAULT,
          label: <FilterKeyOperatorLabel keyLabel="is" includeKeyLabel />,
          textValue: 'is',
        },
        {
          value: TermOperatorNew.NOT_EQUAL,
          label: <FilterKeyOperatorLabel keyLabel="is not" includeKeyLabel />,
          textValue: 'is not',
        },
        {
          value: TermOperatorNew.CONTAINS,
          label: <FilterKeyOperatorLabel keyLabel="contains" includeKeyLabel />,
          textValue: 'contains',
        },
      ],
    };
  }

  return {
    operator,
    label: <OpLabel>{opLabel}</OpLabel>,
    options: getValidOpsForFilter(token)
      .filter(op => op !== TermOperatorNew.EQUAL)
      .map((op): SelectOption<TermOperatorNew> => {
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

  const {operator, label, options} = useMemo(() => getOperatorInfo(token), [token]);

  const onlyOperator = token.filter === FilterType.IS || token.filter === FilterType.HAS;

  let isContains = false;
  if (token.value.type === Token.VALUE_TEXT) {
    isContains = token.value.contains;
  } else if (token.value.type === Token.VALUE_TEXT_LIST) {
    isContains = token.value.items.every(entry => entry.value?.contains);
  }

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
          {isContains ? <OpLabel>contains</OpLabel> : label}
        </OpButton>
      )}
      size="sm"
      options={options}
      value={isContains ? TermOperatorNew.CONTAINS : operator}
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

const OpButton = styled(UnstyledButton)<{onlyOperator?: boolean}>`
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
