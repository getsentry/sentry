import {Fragment, useLayoutEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useFocusWithin} from '@react-aria/interactions';
import {mergeProps} from '@react-aria/utils';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {SearchQueryBuilderParametersCombobox} from 'sentry/components/searchQueryBuilder/tokens/filter/parametersCombobox';
import {UnstyledButton} from 'sentry/components/searchQueryBuilder/tokens/filter/unstyledButton';
import {useFilterButtonProps} from 'sentry/components/searchQueryBuilder/tokens/filter/useFilterButtonProps';
import type {
  AggregateFilter,
  ParseResultToken,
} from 'sentry/components/searchSyntax/parser';
import {getKeyName} from 'sentry/components/searchSyntax/utils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

type AggregateKeyProps = {
  filterRef: React.RefObject<HTMLDivElement>;
  item: Node<ParseResultToken>;
  onActiveChange: (active: boolean) => void;
  state: ListState<ParseResultToken>;
  token: AggregateFilter;
};

export function AggregateKeyVisual({token}: {token: AggregateFilter}) {
  const fnName = getKeyName(token.key);
  const fnParams = token.key.args?.text ?? '';

  return (
    <Fragment>
      <FnName>{fnName}</FnName>
      {'('}
      <Parameters>{fnParams}</Parameters>
      {')'}
    </Fragment>
  );
}

export function AggregateKey({
  item,
  state,
  token,
  onActiveChange,
  filterRef,
}: AggregateKeyProps) {
  const ref = useRef<HTMLDivElement>(null);
  const {dispatch, focusOverride, disabled} = useSearchQueryBuilder();

  const [isEditing, setIsEditing] = useState(false);

  // Enters edit mode when focusOverride is set to this item
  useLayoutEffect(() => {
    if (
      !isEditing &&
      focusOverride?.itemKey === item.key &&
      focusOverride.part === 'key'
    ) {
      setIsEditing(true);
      onActiveChange(true);
      dispatch({type: 'RESET_FOCUS_OVERRIDE'});
    }
  }, [dispatch, focusOverride, isEditing, item.key, onActiveChange]);

  const {focusWithinProps} = useFocusWithin({
    onBlurWithin: () => {
      setIsEditing(false);
    },
  });

  const filterButtonProps = useFilterButtonProps({state, item});

  const fnName = getKeyName(token.key);

  if (isEditing) {
    return (
      <KeyEditing ref={ref} {...mergeProps(focusWithinProps, filterButtonProps)}>
        <UnfocusedText>
          {fnName}
          {'('}
        </UnfocusedText>
        <Parameters>
          <SearchQueryBuilderParametersCombobox
            token={token}
            onDelete={() => {
              filterRef.current?.focus();
              state.selectionManager.setFocusedKey(item.key);
              setIsEditing(false);
              onActiveChange(false);
            }}
            onCommit={() => {
              setIsEditing(false);
              onActiveChange(false);
              if (state.collection.getKeyAfter(item.key)) {
                state.selectionManager.setFocusedKey(
                  state.collection.getKeyAfter(item.key)
                );
              }
            }}
          />
        </Parameters>
        <UnfocusedText>{')'}</UnfocusedText>
      </KeyEditing>
    );
  }

  return (
    <KeyButton
      aria-label={t('Edit parameters for filter: %s', fnName)}
      onClick={() => {
        setIsEditing(true);
        onActiveChange(true);
      }}
      disabled={disabled}
      {...filterButtonProps}
    >
      <InteractionStateLayer />
      <AggregateKeyVisual token={token} />
    </KeyButton>
  );
}

const KeyButton = styled(UnstyledButton)`
  padding: 0 ${space(0.25)} 0 ${space(0.5)};
  height: 100%;
  border-left: 1px solid transparent;
  border-right: 1px solid transparent;
  border-radius: 3px 0 0 3px;

  :focus {
    background-color: ${p => p.theme.translucentGray100};
    border-right: 1px solid ${p => p.theme.innerBorder};
    border-left: 1px solid ${p => p.theme.innerBorder};
  }
`;

const FnName = styled('span')`
  color: ${p => p.theme.green400};
`;

const UnfocusedText = styled('span')`
  color: ${p => p.theme.subText};
`;

const Parameters = styled('span')`
  height: 100%;
`;

const KeyEditing = styled('div')`
  padding: 0 ${space(0.25)} 0 ${space(0.5)};
  max-width: 100%;
  display: flex;
  align-items: center;

  border-left: 1px solid transparent;
  border-right: 1px solid transparent;

  :focus-within {
    ${Parameters} {
      background-color: ${p => p.theme.purple100};
      height: 100%;
    }
  }
`;
