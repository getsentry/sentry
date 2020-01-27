/* eslint-disable react/prop-types */
import React from 'react';
import styled from '@emotion/styled';

import InlineSvg from 'app/components/inlineSvg';
import Badge from 'app/components/badge';
import Flex from 'app/components/flex';
import Text from 'app/components/text';
import TextOverflow from 'app/components/textOverflow';
import space from 'app/styles/space';
import {Event} from 'app/types';

import getThreadDetails, {ThreadDetails, Thread} from './getThreadDetails';
import ThreadsSelectorOptionLabel, {
  ThreadsSelectorOptionLabelType,
} from './threadsSelectorOptionLabel';

const StyledInlineSvgContainer = styled(Flex)(({theme}) => ({
  color: theme.orange,
  minHeight: 28,
}));

const StyledBadge = styled(Badge)({
  marginRight: space(0.75),
});

const StyledThreadName = styled(Text)({
  marginBottom: space(0.5),
  fontWeight: 600,
});

const StyledInfo = styled(Flex)({
  minWidth: 0,
  marginRight: space(0.5),
});

const StyledInfoDetails = styled(Flex)({
  maxWidth: '100%',
});

const StyledContainer = styled(Flex)({
  maxWidth: '100%',
});

const StyledFileName = styled('span')({
  color: '#2c58a8',
});

const StyledTextOverflow = styled(TextOverflow)({
  maxWidth: 235,
});

export interface ThreadsSelectorOptionProps extends Thread {
  details?: ThreadDetails;
}

interface Props {
  thread: Thread;
  event: Event;
  selected?: boolean;
}

const ThreadsSelectorOption: React.FC<Props> = ({thread, event, selected = false}) => {
  const threadDetails = getThreadDetails(thread, event);
  return (
    <StyledContainer flexGrow={1} alignItems="center">
      <StyledBadge text={thread.id} />
      <StyledInfo>
        {selected ? (
          <StyledTextOverflow>
            {threadDetails?.filename ? (
              <>
                {`Thread: ${thread.name} - `}
                <StyledFileName>{threadDetails?.filename}</StyledFileName>
              </>
            ) : (
              thread.name
            )}
          </StyledTextOverflow>
        ) : (
          <StyledInfoDetails flexDirection="column">
            <StyledThreadName>{thread.name}</StyledThreadName>
            {threadDetails &&
              Object.entries(threadDetails).map(([key, value]) => (
                <ThreadsSelectorOptionLabel
                  key={key}
                  label={key as ThreadsSelectorOptionLabelType}
                  value={value}
                />
              ))}
          </StyledInfoDetails>
        )}
      </StyledInfo>
      {thread.crashed && (
        <StyledInlineSvgContainer
          alignItems="center"
          flexGrow={1}
          justifyContent="flex-end"
        >
          <InlineSvg src="icon-circle-exclamation" />
        </StyledInlineSvgContainer>
      )}
    </StyledContainer>
  );
};

export default ThreadsSelectorOption;
