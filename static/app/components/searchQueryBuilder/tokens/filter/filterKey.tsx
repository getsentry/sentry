import {useCallback, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {useFocusWithin} from '@react-aria/interactions';
import {mergeProps} from '@react-aria/utils';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import {useSearchQueryBuilder} from 'sentry/components/searchQueryBuilder/context';
import {FilterKeyCombobox} from 'sentry/components/searchQueryBuilder/tokens/filter/filterKeyCombobox';
import {UnstyledButton} from 'sentry/components/searchQueryBuilder/tokens/filter/unstyledButton';
import {useFilterButtonProps} from 'sentry/components/searchQueryBuilder/tokens/filter/useFilterButtonProps';
import type {
  ParseResultToken,
  Token,
  TokenResult,
} from 'sentry/components/searchSyntax/parser';
import {getKeyName} from 'sentry/components/searchSyntax/utils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {middleEllipsis} from 'sentry/utils/string/middleEllipsis';

type FilterKeyProps = {
  item: Node<ParseResultToken>;
  onActiveChange: (active: boolean) => void;
  state: ListState<ParseResultToken>;
  token: TokenResult<Token.FILTER>;
};

export function FilterKey({item, state, token, onActiveChange}: FilterKeyProps) {
  const ref = useRef<HTMLDivElement>(null);
  const {disabled} = useSearchQueryBuilder();

  const [isEditing, setIsEditing] = useState(false);

  const {focusWithinProps} = useFocusWithin({
    onBlurWithin: () => {
      setIsEditing(false);
      onActiveChange(false);
    },
  });

  const filterButtonProps = useFilterButtonProps({state, item});

  const onCommit = useCallback(() => {
    setIsEditing(false);
    onActiveChange(false);
    if (state.collection.getKeyAfter(item.key)) {
      state.selectionManager.setFocusedKey(state.collection.getKeyAfter(item.key));
    }
  }, [item.key, onActiveChange, state.collection, state.selectionManager]);

  if (isEditing) {
    return (
      <KeyEditing ref={ref} {...mergeProps(focusWithinProps, filterButtonProps)}>
        <FilterKeyCombobox item={item} token={token} onCommit={onCommit} />
      </KeyEditing>
    );
  }

  return (
    <KeyButton
      aria-label={t('Edit key for filter: %s', getKeyName(token.key))}
      onClick={() => {
        setIsEditing(true);
        onActiveChange(true);
      }}
      disabled={disabled}
      {...filterButtonProps}
    >
      <InteractionStateLayer />
      {/* Filter keys have no expected format, so we attempt to split by whitespace, dash, colon, and underscores. */}
      {middleEllipsis(getKeyName(token.key), 40, /[\s-_:]/)}
    </KeyButton>
  );
}

const KeyButton = styled(UnstyledButton)`
  padding: 0 ${space(0.25)} 0 ${space(0.5)};
  color: ${p => p.theme.textColor};
  border-left: 1px solid transparent;
  border-right: 1px solid transparent;
  width: 100%;
  max-width: 400px;

  :focus {
    background-color: ${p => p.theme.purple100};
    border-left: 1px solid ${p => p.theme.innerBorder};
    border-right: 1px solid ${p => p.theme.innerBorder};
  }
`;

const KeyEditing = styled('div')`
  padding: 0 ${space(0.25)};
  color: ${p => p.theme.purple400};
  border-left: 1px solid transparent;
  border-right: 1px solid transparent;
  max-width: 100%;

  :focus-within {
    background-color: ${p => p.theme.translucentGray100};
    border-right: 1px solid ${p => p.theme.innerBorder};
    border-left: 1px solid ${p => p.theme.innerBorder};
  }
`;
