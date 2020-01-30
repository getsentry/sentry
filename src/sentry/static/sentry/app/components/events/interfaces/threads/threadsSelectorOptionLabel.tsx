import React from 'react';
import styled from '@emotion/styled';

import {Frame} from 'app/types/events';
import TextOverflow from 'app/components/textOverflow';

interface Props {
  label: keyof Frame;
  value: string;
}

const ThreadsSelectorOptionLabel: React.FC<Props> = ({label, value}) => {
  switch (label) {
    case 'filename':
      return (
        <StyledFileName>
          {`(`}
          <TextOverflow>{value}</TextOverflow>
          {`)`}
        </StyledFileName>
      );
    case 'function':
      return <StyledFunctionName>{value}</StyledFunctionName>;
    case 'module':
      return <TextOverflow>{value}</TextOverflow>;
    case 'package':
      return <TextOverflow>{value}</TextOverflow>;
    default:
      return null;
  }
};

export default ThreadsSelectorOptionLabel;

const StyledFunctionName = styled(TextOverflow)({
  color: '#2c58a8',
  maxWidth: '100%',
});

const StyledFileName = styled(TextOverflow)({
  color: '#6c5fc7',
  maxWidth: '100%',
  display: 'flex',
});
