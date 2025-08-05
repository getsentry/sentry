import {useRef} from 'react';
import styled from '@emotion/styled';
import {type AriaListBoxOptions, useListBox, useOption} from '@react-aria/listbox';
import type {ListState} from '@react-stately/list';
import type {Node} from '@react-types/shared';

interface SeerSearchListBoxProps extends AriaListBoxOptions<unknown> {
  state: ListState<unknown>;
  listBoxRef?: React.RefObject<HTMLUListElement | null>;
}

export function SeerSearchListBox(props: SeerSearchListBoxProps) {
  const ref = useRef<HTMLUListElement>(null);
  const {listBoxRef = ref, state} = props;
  const {listBoxProps} = useListBox(props, state, listBoxRef);

  return (
    <StyledUl {...listBoxProps} ref={listBoxRef}>
      {[...state.collection].map(item => (
        <SeerSearchOption key={item.key} item={item} state={state} />
      ))}
    </StyledUl>
  );
}

interface SeerSearchOptionProps {
  item: Node<unknown>;
  state: ListState<unknown>;
}

function SeerSearchOption({item, state}: SeerSearchOptionProps) {
  const ref = useRef<HTMLLIElement>(null);
  const {optionProps, isFocused} = useOption({key: item.key}, state, ref);

  return (
    <StyledOption {...optionProps} ref={ref} isFocused={isFocused}>
      {item.rendered}
    </StyledOption>
  );
}

const StyledUl = styled('ul')`
  width: 100%;
  max-height: 18rem;
  overflow: auto;
  outline: none;
  margin: 0;
  padding: 0;

  & > :not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.border};
  }
`;

const StyledOption = styled('li')<{isFocused: boolean}>`
  width: 100%;
  cursor: pointer;
  list-style: none;
  transition: background-color 0.2s ease;
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.xl};
  background-color: ${p => (p.isFocused ? p.theme.purple100 : 'transparent')};

  &:hover {
    background-color: ${p => p.theme.purple100};
  }

  &:focus {
    background-color: ${p => p.theme.purple100};
  }

  &[aria-selected='true'] {
    background-color: ${p => p.theme.purple100};
  }

  &[data-is-none-of-these],
  &[data-is-example] {
    padding: ${p => p.theme.space.lg} ${p => p.theme.space['2xl']};
  }
`;
