import React from 'react';
import styled from '@emotion/styled';

import {Frame} from 'app/types/events';
import space from 'app/styles/space';
import TextOverflow from 'app/components/textOverflow';
import Text from 'app/components/text';
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
      <StyledNameID>{name ? `#${id}: ${name}` : `#${id}`}</StyledNameID>
      {mostImportantInfoToBeDisplayed ? (
        <>
          <ThreadsSelectorOptionLabel
            label={mostImportantInfoToBeDisplayed[0] as keyof Frame}
            value={mostImportantInfoToBeDisplayed[1]}
          />
          {mostImportantInfoToBeDisplayed[0] !== 'filename' && frame.filename && (
            <ThreadsSelectorOptionLabel label="filename" value={frame.filename} />
          )}
        </>
      ) : (
        <Text>{`<unknown>`}</Text>
      )}
      {crashed && <StyledCrashIcon src="icon-warning-sm" />}
    </StyledContainer>
  );
};

export default ThreadsSelectorOption;

const StyledCrashIcon = styled(InlineSvg)({
  color: '#ec5e44',
  marginLeft: space(1),
});

const StyledContainer = styled('div')({
  display: 'grid',
  maxWidth: '100%',
  overflow: 'hidden',
  gridTemplateColumns: '110px 1fr auto 28px',
  justifyContent: 'flex-start',
  justifyItems: 'start',
  paddingLeft: space(1),
});

const StyledNameID = styled(TextOverflow)({
  paddingRight: space(1),
  maxWidth: '100%',
});
