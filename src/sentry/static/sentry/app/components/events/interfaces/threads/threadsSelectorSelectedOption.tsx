import React from 'react';
import styled from '@emotion/styled';

import {Frame} from 'app/types/events';
import TextOverflow from 'app/components/textOverflow';
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
      {mostImportantInfoToBeDisplayed ? (
        <ThreadsSelectorOptionLabel
          label={mostImportantInfoToBeDisplayed[0] as keyof Frame}
          value={mostImportantInfoToBeDisplayed[1]}
        />
      ) : (
        <Text>{`<unknown>`}</Text>
      )}
    </StyledContainer>
  );
};

export default ThreadsSelectorSelectedOption;

const StyledContainer = styled('div')({
  gridTemplateColumns: '110px 260px',
  display: 'grid',
  justifyContent: 'flex-start',
  alignItems: 'center',
  justifyItems: 'start',
});

const StyledThreadID = styled(TextOverflow)({
  paddingRight: space(1),
});
