/* eslint-disable react/prop-types */
import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import TextOverflow from 'app/components/textOverflow';
import InlineSvg from 'app/components/inlineSvg';
import {EntryTypeData} from 'app/types';

interface Props {
  id: string;
  name?: string;
  crashed?: boolean;
  details: ThreadInfo;
  crashedInfo?: EntryTypeData;
}

interface ThreadInfo {
  label: string;
  filename?: string;
}

const ThreadsSelectorOption: React.FC<Props> = ({
  id,
  name,
  details,
  crashed,
  crashedInfo,
}) => (
  <StyledContainer>
    <StyledNameID>{name ? `#${id}: ${name}` : `#${id}`}</StyledNameID>
    <StyledLabelsContainer>
      <StyledOptionLabel>{details.label}</StyledOptionLabel>
      {details.filename && (
        <StyledFileName>
          {'('}
          <StyledOptionLabel>{details.filename}</StyledOptionLabel>
          {')'}
        </StyledFileName>
      )}
    </StyledLabelsContainer>
    {crashed && (
      <StyledCrashIcon
        src="icon-warning-sm"
        title={crashedInfo ? `(crashed with ${crashedInfo.values[0].type})` : ''}
      />
    )}
  </StyledContainer>
);

export default ThreadsSelectorOption;

const StyledLabelsContainer = styled('div')({
  display: 'grid',
  gridTemplateColumns: '1fr 200px',
  width: '100%',
});

const StyledContainer = styled('div')({
  display: 'grid',
  maxWidth: '100%',
  overflow: 'hidden',
  gridTemplateColumns: '110px 1fr 28px',
  justifyContent: 'flex-start',
  justifyItems: 'start',
  paddingLeft: space(1),
});

const StyledNameID = styled(TextOverflow)({
  paddingRight: space(1),
  maxWidth: '100%',
  textAlign: 'left',
});

const StyledCrashIcon = styled(InlineSvg)({
  color: '#ec5e44',
  marginLeft: space(1),
});

const StyledFileName = styled(TextOverflow)(({theme}) => ({
  color: theme.purple,
  display: 'flex',
  width: '100%',
  textAlign: 'left',
}));

const StyledOptionLabel = styled(StyledNameID)({
  // TODO(style): color not yet in the theme
  color: '#2c58a8',
});
