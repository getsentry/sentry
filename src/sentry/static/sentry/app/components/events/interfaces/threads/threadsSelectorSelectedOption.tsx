import React from 'react';
import styled from '@emotion/styled';

import {Frame} from 'app/types/events';
import Text from 'app/components/text';
import space from 'app/styles/space';

import ThreadsSelectorOptionLabel from './ThreadsSelectorOptionLabel';

interface Props {
  id: string;
  frame: Frame;
}

const ThreadsSelectorSelectedOption: React.FC<Props> = ({id, frame}) => {
  const mostImportantInfoToBeDisplayed = Object.entries(frame)[0];
  return (
    <StyledContainer>
      <StyledThreadID>{`Thread #${id}:`}</StyledThreadID>
      <ThreadsSelectorOptionLabel
        label={mostImportantInfoToBeDisplayed[0] as keyof Frame}
        value={mostImportantInfoToBeDisplayed[1]}
      />
    </StyledContainer>
  );
};

export default ThreadsSelectorSelectedOption;

const StyledContainer = styled('div')({
  maxWidth: '100%',
  overflow: 'hidden',
  gridTemplateColumns: 'auto auto',
  display: 'grid',
});

const StyledThreadID = styled(Text)({
  paddingRight: space(0.5),
});
