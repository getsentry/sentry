import React from 'react';
import styled from '@emotion/styled';

import {Frame} from 'app/types/events';
import TextOverflow from 'app/components/textOverflow';
import space from 'app/styles/space';

interface Props {
  label: keyof Frame;
  value: string;
}

const ThreadsSelectorOptionLabel: React.FC<Props> = ({label, value}) => {
  switch (label) {
    case 'filename':
      return <StyledFileName>{value}</StyledFileName>;
    case 'function':
      return <StyledFunctionName>{value}</StyledFunctionName>;
    case 'module':
      return <StyledTextOverflow>{value}</StyledTextOverflow>;
    case 'package':
      return <StyledTextOverflow>{value}</StyledTextOverflow>;
    default:
      return null;
  }
};

export default ThreadsSelectorOptionLabel;

const StyledTextOverflow = styled(TextOverflow)({
  width: 280,
  paddingRight: space(1),
});

const StyledFunctionName = styled(StyledTextOverflow)({
  color: '#2c58a8',
});

const StyledFileName = styled(StyledTextOverflow)({
  color: '#6c5fc7',
});
