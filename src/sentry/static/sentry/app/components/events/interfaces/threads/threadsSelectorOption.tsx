import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import TextOverflow from 'app/components/textOverflow';
import Tooltip from 'app/components/tooltip';
import InlineSvg from 'app/components/inlineSvg';
import {EntryTypeData} from 'app/types';

type Props = {
  id: string;
  details: ThreadInfo;
  crashedInfo?: EntryTypeData;
  name?: string;
  crashed?: boolean;
};

type ThreadInfo = {
  label: string;
  filename?: string;
};

// TODO (i18n): added translations here
const ThreadsSelectorOption = ({id, name, details, crashed, crashedInfo}: Props) => (
  <Wrapper>
    <DetailsWrapper>
      <StyledNameId>{name ? `#${id}: ${name}` : `#${id}`}</StyledNameId>
      <LabelsWrapper>
        <StyledOptionLabel>{details.label}</StyledOptionLabel>
        {details.filename && (
          <StyledFileNameWrapper>
            {'('}
            <StyledFileName>{details.filename}</StyledFileName>
            {')'}
          </StyledFileNameWrapper>
        )}
      </LabelsWrapper>
    </DetailsWrapper>
    {crashed &&
      (crashedInfo ? (
        <Tooltip title={`(crashed with ${crashedInfo.values[0].type}`} position="top">
          <StyledCrashIcon src="icon-warning-sm" />
        </Tooltip>
      ) : (
        <StyledCrashIcon src="icon-warning-sm" />
      ))}
  </Wrapper>
);

export default ThreadsSelectorOption;

const Wrapper = styled('div')`
  grid-template-columns: 1fr 30px;
  display: grid;
  align-items: center;
`;

const DetailsWrapper = styled('div')`
  max-width: 100%;
  overflow: hidden;
  display: grid;
  @media (min-width: ${props => props.theme.breakpoints[0]}) {
    grid-template-columns: 50px 1fr;
  }
  @media (min-width: ${props => props.theme.breakpoints[2]}) {
    grid-template-columns: 100px 1fr;
  }
`;

const LabelsWrapper = styled('div')`
  display: grid;
  width: 100%;
  grid-gap: ${space(0.5)};
  @media (min-width: ${props => props.theme.breakpoints[0]}) {
    grid-template-columns: 1fr 200px;
  }
`;

const StyledNameId = styled(TextOverflow)`
  max-width: 100%;
  text-align: left;
  @media (min-width: ${props => props.theme.breakpoints[0]}) {
    padding-right: ${space(1)};
  }
`;

const StyledCrashIcon = styled(InlineSvg)`
  color: #ec5e44;
  margin-left: ${space(1)};
`;

const StyledFileNameWrapper = styled(TextOverflow)`
  color: ${props => props.theme.purple};
  display: flex;
  text-align: left;
  overflow: hidden;
`;

const StyledFileName = styled(StyledNameId)`
  color: ${props => props.theme.purple};
  padding-right: ${space(0)};
`;

// TODO(style): color not yet in the theme
const StyledOptionLabel = styled(StyledNameId)`
  color: #2c58a8;
  padding-right: ${space(0)};
  font-weight: 600;
`;
