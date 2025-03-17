import {type ReactNode, useMemo} from 'react';
import styled from '@emotion/styled';
import {mergeProps} from '@react-aria/utils';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import {CompactSelect, type SelectOption} from 'sentry/components/compactSelect';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {AggregateKeyVisual} from 'sentry/components/searchQueryBuilder/tokens/filter/aggregateKey';
import {UnstyledButton} from 'sentry/components/searchQueryBuilder/tokens/filter/unstyledButton';
import {useFilterButtonProps} from 'sentry/components/searchQueryBuilder/tokens/filter/useFilterButtonProps';
import {
  getValidOpsForFilter,
  isAggregateFilterToken,
} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
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

const OP_LABELS = {
  [TermOperator.DEFAULT]: 'is',
  [TermOperator.GREATER_THAN]: '>',
  [TermOperator.GREATER_THAN_EQUAL]: '>=',
  [TermOperator.LESS_THAN]: '<',
  [TermOperator.LESS_THAN_EQUAL]: '<=',
  [TermOperator.NOT_EQUAL]: 'is not',
};

const DATE_OP_LABELS = {
  [TermOperator.GREATER_THAN]: 'is after',
  [TermOperator.GREATER_THAN_EQUAL]: 'is on or after',
  [TermOperator.LESS_THAN]: 'is before',
  [TermOperator.LESS_THAN_EQUAL]: 'is on or before',
  [TermOperator.EQUAL]: 'is',
  [TermOperator.DEFAULT]: 'is',
};

const DATE_OPTIONS: TermOperator[] = [
  TermOperator.GREATER_THAN,
  TermOperator.GREATER_THAN_EQUAL,
  TermOperator.LESS_THAN,
  TermOperator.LESS_THAN_EQUAL,
  TermOperator.EQUAL,
];

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

function getTermOperatorFromToken(token: TokenResult<Token.FILTER>) {
  if (token.negated) {
    return TermOperator.NOT_EQUAL;
  }

  return token.operator;
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
  operator: TermOperator;
  options: Array<SelectOption<TermOperator>>;
} {
  if (isDateToken(token)) {
    const operator = getOperatorFromDateToken(token);
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    const opLabel = DATE_OP_LABELS[operator] ?? operator;

    return {
      operator,
      label: <OpLabel>{opLabel}</OpLabel>,
      options: DATE_OPTIONS.map((op): SelectOption<TermOperator> => {
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
          opLabel={operator === TermOperator.NOT_EQUAL ? 'not' : undefined}
          includeKeyLabel
        />
      ),
      options: [
        {
          value: TermOperator.DEFAULT,
          label: <FilterKeyOperatorLabel keyLabel={token.key.text} includeKeyLabel />,
          textValue: 'is',
        },
        {
          value: TermOperator.NOT_EQUAL,
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
          keyLabel={operator === TermOperator.NOT_EQUAL ? 'does not have' : 'has'}
          includeKeyLabel
        />
      ),
      options: [
        {
          value: TermOperator.DEFAULT,
          label: <FilterKeyOperatorLabel keyLabel="has" includeKeyLabel />,
          textValue: 'has',
        },
        {
          value: TermOperator.NOT_EQUAL,
          label: <FilterKeyOperatorLabel keyLabel="does not have" includeKeyLabel />,
          textValue: 'does not have',
        },
      ],
    };
  }

  const keyLabel = token.key.text;
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const opLabel = OP_LABELS[operator] ?? operator;

  return {
    operator,
    label: <OpLabel>{opLabel}</OpLabel>,
    options: getValidOpsForFilter(token)
      .filter(op => op !== TermOperator.EQUAL)
      .map((op): SelectOption<TermOperator> => {
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

export function FilterKeyOperatorVisual({token}: {token: TokenResult<Token.FILTER>}) {
  if (isAggregateFilterToken(token)) {
    const {label} = getOperatorInfo(token);

    return (
      <KeyOpLabelWrapper>
        <div>
          <AggregateKeyVisual token={token} /> {label}
        </div>
      </KeyOpLabelWrapper>
    );
  }

  if (token.filter === FilterType.IS || token.filter === FilterType.HAS) {
    const {label} = getOperatorInfo(token);
    return label;
  }

  return <FilterKeyOperatorLabel keyLabel={token.key.text} opLabel="" />;
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
