import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import ToolTip from 'app/components/tooltip';

import {Z_INDEX_ADD_COLUMN} from './styles';

type Props = {
  onClick: () => void;
};

const AddColumnButton = (props: Props) => {
  const {onClick} = props;
  return (
    <Wrapper onClick={onClick}>
      <ToolTip title={t('Add Column')}>
        <div style={{width: '24px', height: '24px'}}>
          <Vertical />
          <Horizontal />
        </div>
      </ToolTip>
    </Wrapper>
  );
};

const Wrapper = styled('div')`
  height: 24px;
  width: 24px;

  cursor: pointer;

  border-radius: 3px;

  position: absolute;
  top: ${45 - 12}px;
  right: -12px;

  z-index: ${Z_INDEX_ADD_COLUMN};

  background-color: ${p => p.theme.gray2};

  transition: background-color 0.15s ease-in-out;

  &:hover {
    background-color: ${p => p.theme.gray3};
  }
`;

const Vertical = styled('div')`
  background-color: ${p => p.theme.offWhiteLight};

  border-radius: 1px;

  position: absolute;
  top: 4px;
  left: 11px;

  height: 16px;
  width: 2px;
`;

const Horizontal = styled('div')`
  background-color: ${p => p.theme.offWhiteLight};

  border-radius: 1px;

  position: absolute;
  top: 11px;
  left: 4px;

  height: 2px;
  width: 16px;
`;

export default AddColumnButton;
