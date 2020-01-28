/* eslint-disable react/prop-types */
import React from 'react';
import styled from '@emotion/styled';

import InlineSvg from 'app/components/inlineSvg';
import Flex from 'app/components/flex';
import TextOverflow from 'app/components/textOverflow';

import {Thread} from './getThreadDetails';

interface Props {
  thread: Thread;
}

// TODO(i18n): add locale here
const ThreadsSelectorSingleValue: React.FC<Props> = ({thread}) => (
  <StyledContainer flexGrow={1} alignItems="center">
    <StyledInfo flexGrow={1}>
      <TextOverflow>{`Thread: ${thread.id} - ${thread.name}`}</TextOverflow>
    </StyledInfo>
    {thread.crashed && <StyledInlineSvg src="icon-circle-exclamation" />}
  </StyledContainer>
);

export default ThreadsSelectorSingleValue;

const StyledContainer = styled(Flex)({
  maxWidth: '100%',
  minHeight: 28,
});

const StyledInfo = styled(Flex)({
  position: 'absolute',
  maxWidth: 'calc(100% - 40px)',
});

const StyledInlineSvg = styled(InlineSvg)(({theme}) => ({
  color: theme.orange,
  position: 'absolute',
  right: 0,
  width: 30,
}));
