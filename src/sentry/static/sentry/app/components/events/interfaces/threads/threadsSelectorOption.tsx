/* eslint-disable react/prop-types */
import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import TextOverflow from 'app/components/textOverflow';
import InlineSvg from 'app/components/inlineSvg';
import {EntryTypeData} from 'app/types';

type Props = {
  id: string;
  name?: string;
  crashed?: boolean;
  details: ThreadInfo;
  crashedInfo?: EntryTypeData;
};

type ThreadInfo = {
  label: string;
  filename?: string;
};

// TODO (i18n): added translations here
const ThreadsSelectorOption: React.FC<Props> = ({
  id,
  name,
  details,
  crashed,
  crashedInfo,
}) => (
  <Wrapper>
    <StyledNameId>{name ? `#${id}: ${name}` : `#${id}`}</StyledNameId>
    <LabelsWrapper>
      <StyledOptionLabel>{details.label}</StyledOptionLabel>
      {details.filename && (
        <StyledFileName>
          {'('}
          <StyledOptionLabel>{details.filename}</StyledOptionLabel>
          {')'}
        </StyledFileName>
      )}
    </LabelsWrapper>
    {crashed && (
      <StyledCrashIcon
        src="icon-warning-sm"
        title={crashedInfo ? `(crashed with ${crashedInfo.values[0].type})` : ''}
      />
    )}
  </Wrapper>
);

export default ThreadsSelectorOption;

const LabelsWrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr 200px;
  width: 100%;
`;

const Wrapper = styled('div')`
  display: grid;
  maxwidth: 100%;
  overflow: hidden;
  grid-template-columns: 110px 1fr 28px;
  justify-content: flex-start;
  justify-items: start;
  padding-left: ${space(1)};
`;

const StyledNameId = styled(TextOverflow)`
  padding-right: ${space(1)};
  max-width: 100%;
  text-align: left;
`;

const StyledCrashIcon = styled(InlineSvg)`
  color: #ec5e44;
  margin-left: ${space(1)};
`;

const StyledFileName = styled(TextOverflow)`
  color: ${props => props.theme.purple}
  display: flex;
  width: 100%;
  text-align: left;
`;

// TODO(style): color not yet in the theme
const StyledOptionLabel = styled(StyledNameId)`
  color: #2c58a8;
`;
