/* eslint-disable react/prop-types */
/* eslint-disable react/prop-types */
import React from 'react';
import styled from '@emotion/styled';

import {Frame} from 'app/types/events';
import TextOverflow from 'app/components/textOverflow';
import space from 'app/styles/space';

interface Props {
  type: keyof Omit<Frame, 'filename'>;
  value: string;
}

const ThreadsSelectorOptionLabel: React.FC<Props> = ({type, value}) => {
  switch (type) {
    case 'function':
      return <StyledFunctionName>{value}</StyledFunctionName>;
    case 'module':
      return <StyledOptionLabel>{value}</StyledOptionLabel>;
    case 'package':
      return <StyledOptionLabel>{value}</StyledOptionLabel>;
    default:
      return null;
  }
};

export default ThreadsSelectorOptionLabel;

const StyledOptionLabel = styled(TextOverflow)({
  paddingRight: space(1),
  maxWidth: '100%',
  textAlign: 'left',
});

const StyledFunctionName = styled(StyledOptionLabel)({
  // TODO(style): color not yet in the theme
  color: '#2c58a8',
});
