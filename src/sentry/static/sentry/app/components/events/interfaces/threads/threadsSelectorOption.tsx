import React from 'react';
import styled from '@emotion/styled';

import {Frame} from 'app/types/events';
import space from 'app/styles/space';
import TextOverflow from 'app/components/textOverflow';
import InlineSvg from 'app/components/inlineSvg';

import ThreadsSelectorOptionLabel from './ThreadsSelectorOptionLabel';

interface Props {
  id: string;
  name?: string;
  frame: Frame;
  crashed?: boolean;
}

const ThreadsSelectorOption: React.FC<Props> = ({id, name, frame, crashed}) => {
  const mostImportantInfoToBeDisplayed = Object.entries(frame)[0];
  return (
    <StyledContainer>
      <StyledNameID>{`#${id}: ${name}`}</StyledNameID>
      <ThreadsSelectorOptionLabel
        label={mostImportantInfoToBeDisplayed[0] as keyof Frame}
        value={mostImportantInfoToBeDisplayed[1]}
      />
      {mostImportantInfoToBeDisplayed[0] !== 'filename' && frame.filename && (
        <StyledFileName>{`(${frame.filename})`}</StyledFileName>
      )}
      {crashed && <StyledCrashIcon src="icon-warning-sm" />}
    </StyledContainer>
  );
};

export default ThreadsSelectorOption;

const StyledCrashIcon = styled(InlineSvg)({
  color: '#ec5e44',
});

const StyledContainer = styled('div')({
  display: 'grid',
  maxWidth: '100%',
  overflow: 'hidden',
  gridTemplateColumns: '100px 300px auto 15px',
});

const StyledNameID = styled(TextOverflow)({
  paddingRight: space(1),
});

const StyledFileName = styled(TextOverflow)(({theme}) => ({
  paddingRight: space(1),
  color: theme.purple,
}));
