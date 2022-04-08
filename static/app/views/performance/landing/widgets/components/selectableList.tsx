import styled from '@emotion/styled';

import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {RadioLineItem} from 'sentry/components/forms/controls/radioGroup';
import Link from 'sentry/components/links/link';
import Radio from 'sentry/components/radio';
import Tooltip from 'sentry/components/tooltip';
import {IconClose} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';

type Props = {
  items: (() => React.ReactNode)[];
  selectedIndex: number;
  setSelectedIndex: (index: number) => void;
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
}: {children: React.ReactNode; currentIndex: number; isSelected: boolean} & Props) {
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
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 ${space(1)};
`;

export const Subtitle = styled('span')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeMedium};
  display: inline-block;
`;

export const GrowLink = styled(Link)`
  flex-grow: 1;
  display: inherit;
`;

export const WidgetEmptyStateWarning = () => {
  return <StyledEmptyStateWarning small>{t('No results')}</StyledEmptyStateWarning>;
};

export function ListClose(props: {
  onClick: () => void;
  setSelectListIndex: (n: number) => void;
}) {
  return (
    <StyledTooltip title={t('Exclude this transaction from the search filter.')}>
      <StyledIconClose
        onClick={() => {
          props.onClick();
          props.setSelectListIndex(0);
        }}
      />
    </StyledTooltip>
  );
}

const StyledTooltip = styled(Tooltip)`
  display: flex;
  align-items: center;
  justify-content: center;
`;

const StyledIconClose = styled(IconClose)`
  cursor: pointer;
  color: ${p => p.theme.gray200};
`;

const StyledEmptyStateWarning = styled(EmptyStateWarning)`
  min-height: 300px;
  justify-content: center;
`;

const ListItemContainer = styled('div')`
  display: flex;
  border-top: 1px solid ${p => p.theme.border};
  padding: ${space(1)} ${space(2)};
  font-size: ${p => p.theme.fontSizeMedium};
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
