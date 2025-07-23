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

const StyledUl = styled('ul')`
  width: 100%;
  max-height: 18rem;
  overflow: auto;
  outline: none;
  background-color: ${p => p.theme.background};
  margin: 0;
  padding: 0;
`;

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

const StyledOption = styled('li')<{isFocused: boolean}>`
  width: 100%;
  cursor: pointer;
  list-style: none;
  transition: background-color 0.2s ease;
  border-bottom: 1px solid ${p => p.theme.border};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
  background-color: ${p => (p.isFocused ? p.theme.backgroundSecondary : 'transparent')};

  &:last-child {
    border-bottom: none;
  }

  &:hover {
    background-color: ${p => p.theme.backgroundSecondary};
  }

  &:focus {
    background-color: ${p => p.theme.backgroundSecondary};
  }

  &[aria-selected='true'] {
    background-color: ${p => p.theme.backgroundSecondary};
  }
`;
