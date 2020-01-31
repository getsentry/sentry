/* eslint-disable react/prop-types */
import React from 'react';
import styled from '@emotion/styled';

import TextOverflow from 'app/components/textOverflow';
import space from 'app/styles/space';

type Props = {
  id: string;
  details: ThreadInfo;
};

type ThreadInfo = {
  label: string;
  filename?: string;
};

const ThreadsSelectorSelectedOption: React.FC<Props> = ({id, details}) => (
  <StyledContainer>
    <StyledThreadID>{`Thread #${id}:`}</StyledThreadID>
    <StyledOptionLabel>{details.label}</StyledOptionLabel>
  </StyledContainer>
);

export default ThreadsSelectorSelectedOption;

const StyledContainer = styled('div')`
  grid-template-columns: 110px 1fr;
  display: grid;
  justify-content: flex-start;
  align-items: center;
  justify-items: start;
`;

const StyledThreadID = styled(TextOverflow)`
  padding-right: ${space(1)};
  max-width: 100%;
  text-align: left;
`;

// TODO(style): color not yet in the theme
const StyledOptionLabel = styled(StyledThreadID)`
  color: #2c58a8;
`;
