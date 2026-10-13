import {useLayoutEffect, useMemo, useRef, useState} from 'react';
import isPropValid from '@emotion/is-prop-valid';
import styled from '@emotion/styled';
import {useFocusWithin} from '@react-aria/interactions';
import {mergeProps} from '@react-aria/utils';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';

import {
  useSearchQueryBuilderConfig,
  useSearchQueryBuilderState,
} from 'sentry/components/searchQueryBuilder/context';
import {getOperatorInfo} from 'sentry/components/searchQueryBuilder/tokens/filter/getOperatorInfo';
import {UnstyledButton} from 'sentry/components/searchQueryBuilder/tokens/filter/unstyledButton';
import {useFilterButtonProps} from 'sentry/components/searchQueryBuilder/tokens/filter/useFilterButtonProps';
import {recentSearchTypeToLabel} from 'sentry/components/searchQueryBuilder/utils';
import {
  FilterType,
  type ParseResultToken,
  type Token,
  type TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {getKeyName, isRegexOperator} from 'sentry/components/searchSyntax/utils';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';

export {getOperatorInfo} from 'sentry/components/searchQueryBuilder/tokens/filter/getOperatorInfo';

interface FilterOperatorProps {
  item: Node<ParseResultToken>;
  onOpenChange: (isOpen: boolean) => void;
  state: ListState<ParseResultToken>;
  token: TokenResult<Token.FILTER>;
}

const MENU_OFFSET: [number, number] = [0, 12];

export function FilterOperator({state, item, token, onOpenChange}: FilterOperatorProps) {
  const organization = useOrganization();
  const {dispatch, query, focusOverride} = useSearchQueryBuilderState();
  const {
    allowRegexOperators,
    searchSource,
    recentSearches,
    disabled,
    disallowNegation,
    getFieldDefinition,
  } = useSearchQueryBuilderConfig();
  const filterButtonProps = useFilterButtonProps({state, item});
  const {focusWithinProps} = useFocusWithin({});

  const {operator, label, options} = useMemo(
    () =>
      getOperatorInfo({
        filterToken: token,
        fieldDefinition: getFieldDefinition(token.key.text),
        disallowNegation,
        allowRegexOperators,
      }),
    [token, getFieldDefinition, disallowNegation, allowRegexOperators]
  );

  const onlyOperator = token.filter === FilterType.IS || token.filter === FilterType.HAS;

  const [autoFocus, setAutoFocus] = useState(false);
  // track to see if we have already clicked the button
  const initialOpClickedRef = useRef(false);
  // track to see if we have already set the initial operator
  const initialOpSettingRef = useRef(false);

  useLayoutEffect(() => {
    if (focusOverride?.itemKey === item.key && focusOverride.part === 'op') {
      // oxlint-disable-next-line react/set-state-in-effect
      setAutoFocus(true);
      initialOpSettingRef.current = true;
      dispatch({type: 'RESET_FOCUS_OVERRIDE'});
    }
    // oxlint-disable-next-line react/exhaustive-effect-dependencies
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
              if (!r || !triggerProps.ref) {
                return;
              }

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

        const focusValue =
          initialOpSettingRef.current ||
          (isRegexOperator(option.value) && !isRegexOperator(token.operator));

        dispatch({
          type: 'UPDATE_FILTER_OP',
          token,
          op: option.value,
          focusOverride: focusValue
            ? {
                itemKey: `${item.key}`,
                part: 'value',
              }
            : undefined,
          shouldCommitQuery: !focusValue,
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
