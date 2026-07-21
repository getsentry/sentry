import {useRef} from 'react';
import styled from '@emotion/styled';
import {useListBox, useOption, type AriaListBoxOptions} from '@react-aria/listbox';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

interface SeerSearchListBoxProps extends AriaListBoxOptions<unknown> {
  hasAskSeerUxRework: boolean;
  state: ListState<unknown>;
  listBoxRef?: React.RefObject<HTMLUListElement | null>;
}

export function AskSeerSearchListBox(props: SeerSearchListBoxProps) {
  const ref = useRef<HTMLUListElement>(null);
  const {listBoxRef = ref, state} = props;
  const {listBoxProps} = useListBox(props, state, listBoxRef);

  return (
    <StyledUl
      {...listBoxProps}
      ref={listBoxRef}
      $hasAskSeerUxRework={props.hasAskSeerUxRework}
    >
      {[...state.collection].map(item => {
        return (
          <SeerSearchOption
            key={item.key}
            item={item}
            state={state}
            label={item['aria-label']}
          />
        );
      })}
    </StyledUl>
  );
}

interface SeerSearchOptionProps {
  item: Node<unknown>;
  state: ListState<unknown>;
  label?: string;
}

function SeerSearchOption({item, state, label}: SeerSearchOptionProps) {
  const ref = useRef<HTMLLIElement>(null);
  const {optionProps, isFocused} = useOption({key: item.key}, state, ref);

  return (
    <StyledOption {...optionProps} aria-label={label} ref={ref} isFocused={isFocused}>
      {item.rendered}
    </StyledOption>
  );
}

const StyledUl = styled('ul')<{$hasAskSeerUxRework: boolean}>`
  --ask-seer-option-interaction-background: ${p =>
    p.$hasAskSeerUxRework
      ? p.theme.tokens.interactive.transparent.neutral.background.hover
      : p.theme.tokens.background.transparent.accent.muted};

  width: 100%;
  max-height: 18rem;
  overflow: auto;
  outline: none;
  margin: 0;
  padding: 0;

  &:not(:first-child) {
    border-top: 1px solid ${p => p.theme.tokens.border.primary};
  }

  & > :not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  }
`;

const StyledOption = styled('li')<{isFocused: boolean}>`
  width: 100%;
  cursor: pointer;
  list-style: none;
  transition: background-color 0.2s ease;
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.xl};
  background-color: ${p =>
    p.isFocused ? 'var(--ask-seer-option-interaction-background)' : 'transparent'};

  &:hover {
    background-color: var(--ask-seer-option-interaction-background);
  }

  &:focus {
    background-color: var(--ask-seer-option-interaction-background);
  }

  &[aria-selected='true'] {
    background-color: var(--ask-seer-option-interaction-background);
  }

  &[data-is-none-of-these],
  &[data-is-example] {
    padding: ${p => p.theme.space.lg} ${p => p.theme.space['2xl']};
  }
`;
