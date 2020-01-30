/* eslint-disable react/prop-types */
import React from 'react';
import styled from '@emotion/styled';

import {Frame} from 'app/types/events';
import space from 'app/styles/space';
import TextOverflow from 'app/components/textOverflow';
import Text from 'app/components/text';
import InlineSvg from 'app/components/inlineSvg';
import {EntryTypeData} from 'app/types';

import ThreadsSelectorOptionLabel from './threadsSelectorOptionLabel';

const NOT_FOUND_FRAME = '<unknown>';

interface Props {
  id: string;
  name?: string;
  details: ThreadInfo;
  crashedInfo?: EntryTypeData;
}

interface ThreadInfo {
  label:
    | typeof NOT_FOUND_FRAME
    | {
        type: keyof Omit<Frame, 'filename'>;
        value: string;
      };
  filename?: string;
}

const ThreadsSelectorOption: React.FC<Props> = ({id, name, details, crashedInfo}) => (
  <StyledContainer>
    <StyledNameID>{name ? `#${id}: ${name}` : `#${id}`}</StyledNameID>
    <StyledLabelsContainer>
      {details.label !== NOT_FOUND_FRAME ? (
        <ThreadsSelectorOptionLabel
          type={details.label.type}
          value={details.label.value}
        />
      ) : (
        <Text>{details.label}</Text>
      )}
      {details.filename && (
        <StyledFileName>
          {'('}
          <TextOverflow>{details.filename}</TextOverflow>
          {')'}
        </StyledFileName>
      )}
    </StyledLabelsContainer>
    {crashedInfo && (
      <StyledCrashIcon
        src="icon-warning-sm"
        title={`(crashed with ${crashedInfo.values[0].type})`}
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
