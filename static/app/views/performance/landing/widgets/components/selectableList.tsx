import React, {ReactNode} from 'react';
import styled from '@emotion/styled';

import Radio from 'app/components/radio';
import space from 'app/styles/space';
import {RadioLineItem} from 'app/views/settings/components/forms/controls/radioGroup';

type Props = {
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
  items: (() => ReactNode)[];
  radioColor?: string;
};

export default function SelectableList(props: Props) {
  return (
    <div>
      {props.items.map((item, index) => (
        <SelectableItem
          {...props}
          isSelected={index === props.selectedIndex}
          currentIndex={index}
          key={index}
        >
          {item()}
        </SelectableItem>
      ))}
    </div>
  );
}

function SelectableItem({
  isSelected,
  currentIndex: index,
  children,
  setSelectedIndex,
  radioColor,
}: {isSelected: boolean; currentIndex: number; children: React.ReactNode} & Props) {
  return (
    <ListItemContainer>
      <ItemRadioContainer color={radioColor ?? ''}>
        <RadioLineItem index={index} role="radio">
          <Radio checked={isSelected} onChange={() => setSelectedIndex(index)} />
        </RadioLineItem>
      </ItemRadioContainer>
      {children}
    </ListItemContainer>
  );
}

export const RightAlignedCell = styled('div')`
  text-align: right;
`;

const ListItemContainer = styled('div')`
  display: flex;

  border-top: 1px solid ${p => p.theme.border};
  padding: ${space(1)} ${space(2)};
`;

const ItemRadioContainer = styled('div')`
  grid-row: 1/3;
  input {
    cursor: pointer;
  }
  input:checked::after {
    background-color: ${p => p.color};
  }
`;
