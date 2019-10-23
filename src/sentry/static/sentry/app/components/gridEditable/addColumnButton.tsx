import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import ToolTip from 'app/components/tooltip';

import {GRID_HEADER_HEIGHT, Z_INDEX_ADD_COLUMN} from './styles';

// this is an even number
const BUTTON_SIZE = 20;
const PLUS_SIGN_WIDTH = 2;
const PLUS_SIGN_HEIGHT = 12;

type Props = {
  onClick: () => void;
};

const AddColumnButton = (props: Props) => {
  const {onClick} = props;
  return (
    <Wrapper onClick={onClick}>
      <ToolTip title={t('Add Column')}>
        <div style={{width: `${BUTTON_SIZE}px`, height: `${BUTTON_SIZE}px`}}>
          <Vertical />
          <Horizontal />
        </div>
      </ToolTip>
    </Wrapper>
  );
};

const Wrapper = styled('div')`
  height: ${BUTTON_SIZE}px;
  width: ${BUTTON_SIZE}px;

  cursor: pointer;

  border-radius: 3px;

  position: absolute;
  top: ${GRID_HEADER_HEIGHT - BUTTON_SIZE / 2}px;
  right: -${BUTTON_SIZE / 2}px;

  z-index: ${Z_INDEX_ADD_COLUMN};

  background-color: ${p => p.theme.gray2};

  transition: background-color 0.15s ease-in-out;

  &:hover {
    background-color: ${p => p.theme.gray3};
  }
`;

const OFFSET_LONG_SIDE = (BUTTON_SIZE - PLUS_SIGN_HEIGHT) / 2;
const OFFSET_SHORT_SIDE = (BUTTON_SIZE - PLUS_SIGN_WIDTH) / 2;

const Vertical = styled('div')`
  background-color: ${p => p.theme.offWhiteLight};

  border-radius: 1px;

  position: absolute;
  top: ${OFFSET_LONG_SIDE}px;
  left: ${OFFSET_SHORT_SIDE}px;

  height: ${PLUS_SIGN_HEIGHT}px;
  width: ${PLUS_SIGN_WIDTH}px;
`;

const Horizontal = styled('div')`
  background-color: ${p => p.theme.offWhiteLight};

  border-radius: 1px;

  position: absolute;
  top: ${OFFSET_SHORT_SIDE}px;
  left: ${OFFSET_LONG_SIDE}px;

  height: ${PLUS_SIGN_WIDTH}px;
  width: ${PLUS_SIGN_HEIGHT}px;
`;

export default AddColumnButton;
