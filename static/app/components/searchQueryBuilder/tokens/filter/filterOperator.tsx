import {useLayoutEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';
import {useFocusWithin} from '@react-aria/interactions';
import {mergeProps} from '@react-aria/utils';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import {CompactSelect, type SelectOption} from 'sentry/components/core/compactSelect';
import InteractionStateLayer from 'sentry/components/core/interactionStateLayer';
import {Flex} from 'sentry/components/core/layout';
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
import {
  isDateToken,
  recentSearchTypeToLabel,
} from 'sentry/components/searchQueryBuilder/utils';
import {
  FilterType,
  TermOperator,
  type ParseResultToken,
  type Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {getKeyName} from 'sentry/components/searchSyntax/utils';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import type {FieldDefinition} from 'sentry/utils/fields';
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
    <Flex align="center" gap="sm">
      <Tooltip title={fieldDefinition?.desc}>
        <span>{keyLabel}</span>
        {opLabel ? <OpLabel> {opLabel}</OpLabel> : null}
      </Tooltip>
    </Flex>
  );
}

export function getOperatorInfo({
  filterToken,
  fieldDefinition,
}: {
  fieldDefinition: FieldDefinition | null;
  filterToken: TokenResult<Token.FILTER>;
}): {
  label: ReactNode;
  operator: TermOperator;
  options: Array<SelectOption<TermOperator>>;
} {
  if (isDateToken(filterToken)) {
    const operator = getOperatorFromDateToken(filterToken);
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    const opLabel = DATE_OP_LABELS[operator] ?? operator;

    return {
      operator,
      label: <OpLabel>{opLabel}</OpLabel>,
      options: DATE_OPTIONS.map((op): SelectOption<TermOperator> => {
        const optionOpLabel = DATE_OP_LABELS[op] ?? op;

        return {
          value: op,
          textValue: optionOpLabel,
          label: <OpLabel>{optionOpLabel}</OpLabel>,
        };
      }),
    };
  }

  const {operator, label} = getLabelAndOperatorFromToken(filterToken);

  if (filterToken.filter === FilterType.IS) {
    return {
      operator,
      label: (
        <FilterKeyOperatorLabel
          keyValue={filterToken.key.value}
          keyLabel={filterToken.key.text}
          opLabel={operator === TermOperator.NOT_EQUAL ? 'not' : undefined}
          includeKeyLabel
        />
      ),
      options: [
        {
          value: TermOperator.DEFAULT,
          label: (
            <FilterKeyOperatorLabel
              keyLabel={filterToken.key.text}
              keyValue={filterToken.key.value}
              includeKeyLabel
            />
          ),
          textValue: 'is',
        },
        {
          value: TermOperator.NOT_EQUAL,
          label: (
            <FilterKeyOperatorLabel
              keyLabel={filterToken.key.text}
              keyValue={filterToken.key.value}
              opLabel="not"
              includeKeyLabel
            />
          ),
          textValue: 'is not',
        },
      ],
    };
  }

  if (filterToken.filter === FilterType.HAS) {
    return {
      operator,
      label: (
        <FilterKeyOperatorLabel
          keyValue={filterToken.key.value}
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
              keyValue={filterToken.key.value}
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
              keyValue={filterToken.key.value}
              includeKeyLabel
            />
          ),
          textValue: 'does not have',
        },
      ],
    };
  }

  const keyLabel = filterToken.key.text;

  return {
    operator,
    label: <OpLabel>{label}</OpLabel>,
    options: getValidOpsForFilter({filterToken, fieldDefinition})
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
  const {
    dispatch,
    searchSource,
    query,
    recentSearches,
    disabled,
    focusOverride,
    getFieldDefinition,
  } = useSearchQueryBuilder();
  const filterButtonProps = useFilterButtonProps({state, item});
  const {focusWithinProps} = useFocusWithin({});

  const {operator, label, options} = useMemo(
    () =>
      getOperatorInfo({
        filterToken: token,
        fieldDefinition: getFieldDefinition(token.key.text),
      }),
    [token, getFieldDefinition]
  );

  const onlyOperator = token.filter === FilterType.IS || token.filter === FilterType.HAS;

  const [autoFocus, setAutoFocus] = useState(false);
  // track to see if we have already clicked the button
  const initialOpClickedRef = useRef(false);
  // track to see if we have already set the initial operator
  const initialOpSettingRef = useRef(false);

  useLayoutEffect(() => {
    if (focusOverride?.itemKey === item.key && focusOverride.part === 'op') {
      setAutoFocus(true);
      initialOpSettingRef.current = true;
      dispatch({type: 'RESET_FOCUS_OVERRIDE'});
    }
  }, [dispatch, focusOverride, item.key, onOpenChange]);

  return (
    <CompactSelect
      disabled={disabled}
      trigger={triggerProps => {
        return (
          <OpButton
            disabled={disabled}
            aria-label={t('Edit operator for filter: %s', token.key.text)}
            onlyOperator={onlyOperator}
            {...mergeProps(triggerProps, filterButtonProps, focusWithinProps)}
            ref={r => {
              if (!r || !triggerProps.ref) return;

              if (typeof triggerProps.ref === 'function') {
                triggerProps.ref(r);
              } else {
                triggerProps.ref.current = r;
              }

              if (
                autoFocus &&
                !initialOpClickedRef.current &&
                initialOpSettingRef.current
              ) {
                r.click();
                initialOpClickedRef.current = true;
              }
            }}
          >
            <InteractionStateLayer />
            {label}
          </OpButton>
        );
      }}
      size="sm"
      autoFocus={autoFocus}
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
          focusOverride: initialOpSettingRef.current
            ? {
                itemKey: `${item.key}`,
                part: 'value',
              }
            : undefined,
          shouldCommitQuery: !initialOpSettingRef.current,
        });
        initialOpSettingRef.current = false;
        setAutoFocus(false);
      }}
      offset={MENU_OFFSET}
      onInteractOutside={() => {
        setAutoFocus(false);
      }}
    />
  );
}

const OpButton = styled(UnstyledButton, {
  shouldForwardProp: isPropValid,
})<{onlyOperator?: boolean}>`
  padding: 0 ${p => p.theme.space['2xs']} 0 ${p => p.theme.space.xs};
  height: 100%;
  border-left: 1px solid transparent;
  border-right: 1px solid transparent;

  border-radius: ${p => (p.onlyOperator ? '3px 0 0 3px' : 0)};

  :focus {
    background-color: ${p => p.theme.colors.gray100};
    border-right: 1px solid ${p => p.theme.tokens.border.secondary};
    border-left: 1px solid ${p => p.theme.tokens.border.secondary};
  }
`;

const OpLabel = styled('span')`
  color: ${p => p.theme.subText};
`;
