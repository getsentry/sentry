/* eslint-disable react/prop-types */
import React from 'react';
import styled from '@emotion/styled';

import InlineSvg from 'app/components/inlineSvg';
import Flex from 'app/components/flex';
import Text from 'app/components/text';
import {Event} from 'app/types';

import getThreadDetails, {ThreadDetails, Thread} from './getThreadDetails';
import ThreadsSelectorOptionLabel, {
  ThreadsSelectorOptionLabelType,
} from './threadsSelectorOptionLabel';

export interface ThreadsSelectorOptionProps extends Thread {
  details?: ThreadDetails;
}

interface Props {
  thread: Thread;
  event: Event;
}

// TODO(i18n): add locale here
const ThreadsSelectorOption: React.FC<Props> = ({thread, event}) => {
  const threadDetails = getThreadDetails(thread, event);
  return (
    <StyledContainer flexGrow={1}>
      <StyledDetailsContainer flexGrow={1} flexDirection="column">
        <StyledText>{`#${thread.id}`}</StyledText>
        {thread.name && <StyledText>{thread.name}</StyledText>}
        {threadDetails &&
          Object.entries(threadDetails).map(([key, value]) => (
            <ThreadsSelectorOptionLabel
              key={key}
              label={key as ThreadsSelectorOptionLabelType}
              value={value}
            />
          ))}
      </StyledDetailsContainer>
      {thread.crashed && <StyledInlineSvg src="icon-circle-exclamation" />}
    </StyledContainer>
  );
};

export default ThreadsSelectorOption;

const StyledText = styled(Text)({
  maxWidth: '100%',
  overflowWrap: 'break-word',
});

const StyledContainer = styled(Flex)({
  maxWidth: '100%',
});

const StyledDetailsContainer = styled(Flex)({
  maxWidth: '100%',
  paddingRight: 5,
});

const StyledInlineSvg = styled(InlineSvg)(({theme}) => ({
  color: theme.orange,
}));
