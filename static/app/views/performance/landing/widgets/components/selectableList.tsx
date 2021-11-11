import React, {ReactNode} from 'react';
import styled from '@emotion/styled';

import EmptyStateWarning from 'app/components/emptyStateWarning';
import Link from 'app/components/links/link';
import Radio from 'app/components/radio';
import Tooltip from 'app/components/tooltip';
import {IconClose} from 'app/icons';
import {t} from 'app/locale';
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

export const Subtitle = styled('span')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeMedium};
`;
export const GrowLink = styled(Link)`
  flex-grow: 1;
`;

export const WidgetEmptyStateWarning = () => {
  return <StyledEmptyStateWarning small>{t('No results')}</StyledEmptyStateWarning>;
};

export function ListClose(props: {
  onClick: () => void;
  setSelectListIndex: (n: number) => void;
}) {
  return (
    <CloseContainer>
      <Tooltip title={t('Exclude this transaction from the search filter.')}>
        <StyledIconClose
          onClick={() => {
            props.onClick();
            props.setSelectListIndex(0);
          }}
        />
      </Tooltip>
    </CloseContainer>
  );
}

const CloseContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: center;
  padding-left: ${space(1)};
`;

const StyledIconClose = styled(IconClose)`
  cursor: pointer;
  color: ${p => p.theme.gray200};

  &:hover {
    color: ${p => p.theme.gray300};
  }
`;

const StyledEmptyStateWarning = styled(EmptyStateWarning)`
  min-height: 300px;
  justify-content: center;
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
