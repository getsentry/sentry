import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import ToolTip from 'app/components/tooltip';
import InlineSvg from 'app/components/inlineSvg';

import {GRID_HEADER_HEIGHT, Z_INDEX_ADD_COLUMN} from './styles';

// this is an even number
const BUTTON_SIZE = 16;

type Props = {
  onClick: () => void;
};

const AddColumnButton = (props: Props) => {
  const {onClick} = props;
  return (
    <Wrapper onClick={onClick}>
      <ToolTip title={t('Add Column')}>
        <AddButtonWrap>
          <InlineSvg
            src="icon-circle-add"
            data-test-id="grid-column-add"
            style={{position: 'absolute'}}
          />
        </AddButtonWrap>
      </ToolTip>
    </Wrapper>
  );
};

const Wrapper = styled('div')`
  height: ${GRID_HEADER_HEIGHT}px;
  width: ${BUTTON_SIZE}px;

  cursor: pointer;

  border-radius: 100%;

  position: absolute;
  top: 0;
  right: -${BUTTON_SIZE / 2}px;

  z-index: ${Z_INDEX_ADD_COLUMN};

  background-color: ${p => p.theme.offWhite};

  color: ${p => p.theme.gray2};
  &:hover {
    color: ${p => p.theme.gray3};
  }

  transition: background-color 0.15s ease-in-out;
`;

const AddButtonWrap = styled('div')`
  width: ${BUTTON_SIZE}px;
  height: ${GRID_HEADER_HEIGHT}px;

  display: flex;
  align-items: center;
`;

export default AddColumnButton;
