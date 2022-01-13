import {Dispatch, SetStateAction, useState} from 'react';
import {Manager, Reference} from 'react-popper';
import styled from '@emotion/styled';

import space from 'sentry/styles/space';

import IconPopper from './popper';
import IconSample from './sample';
import {ExtendedIconData, SelectedIcon} from './searchPanel';

type Props = {
  icon: ExtendedIconData;
  selectedIcon: SelectedIcon;
  setSelectedIcon: Dispatch<SetStateAction<SelectedIcon>>;
  groupId: string;
};

const IconInfoBox = ({icon, selectedIcon, setSelectedIcon, groupId}: Props) => {
  const isSelected = selectedIcon.group === groupId && selectedIcon.icon === icon.id;
  const [boxRef, setBoxRef] = useState(null);

  return (
    <Manager>
      <Reference>
        {({ref: popperRef}) => (
          <BoxWrap
            ref={ref => {
              setBoxRef(ref);
              popperRef(ref);
            }}
            selected={isSelected}
            onClick={() =>
              setSelectedIcon(
                isSelected ? {group: '', icon: ''} : {group: groupId, icon: icon.id}
              )
            }
          >
            <IconSample
              name={icon.name}
              size="xl"
              color="gray500"
              {...icon.defaultProps}
            />
            <Name>{icon.name}</Name>
          </BoxWrap>
        )}
      </Reference>
      {isSelected && (
        <IconPopper icon={icon} setSelectedIcon={setSelectedIcon} boxRef={boxRef} />
      )}
    </Manager>
  );
};

export default IconInfoBox;

const BoxWrap = styled('div')<{selected: boolean}>`
  grid-column-end: span 1;
  text-align: center;
  justify-content: center;
  padding: ${space(2)};
  border: solid 1px transparent;
  border-radius: ${p => p.theme.borderRadius};
  cursor: pointer;

  &:hover {
    border-color: ${p => p.theme.innerBorder};
  }

  ${p =>
    p.selected &&
    `
    border-color: ${p.theme.blue200};
    background: ${p.theme.blue100};

    &:hover {
      border-color: ${p.theme.blue200};
    }
    `}
`;

const Name = styled('p')`
  position: relative;
  margin-top: ${space(1)};
  margin-bottom: 0;
  font-size: 0.875rem;
  text-transform: capitalize;
`;
