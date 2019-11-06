import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import ToolTip from 'app/components/tooltip';
import InlineSvg from 'app/components/inlineSvg';

import {GRID_HEADER_HEIGHT, Z_INDEX_ADD_COLUMN, ADD_BUTTON_SIZE} from './styles';

type Props = {
  onClick: () => void;
  align: 'left' | 'right';
  ['data-test-id']: string;
};

const AddColumnButton = (props: Props) => {
  const {onClick, align} = props;

  let style;

  if (align === 'right') {
    style = {
      right: `-${ADD_BUTTON_SIZE / 2}px`,
    };
  } else {
    style = {
      left: `-${ADD_BUTTON_SIZE + (12 - ADD_BUTTON_SIZE / 2)}px`,
    };
  }

  return (
    <Wrapper onClick={onClick} data-test-id={props['data-test-id']} style={style}>
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
  width: ${ADD_BUTTON_SIZE}px;

  cursor: pointer;

  position: absolute;
  top: 0;

  z-index: ${Z_INDEX_ADD_COLUMN};

  color: ${p => p.theme.gray2};
  &:hover {
    color: ${p => p.theme.gray3};
  }
`;

const AddButtonWrap = styled('div')`
  width: ${ADD_BUTTON_SIZE}px;
  height: ${GRID_HEADER_HEIGHT}px;

  display: flex;
  align-items: center;
`;

export default AddColumnButton;
