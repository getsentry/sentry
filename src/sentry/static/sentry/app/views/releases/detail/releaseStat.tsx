import * as React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import QuestionTooltip from 'app/components/questionTooltip';

type Props = {
  label: string;
  children: React.ReactNode;
  help?: React.ReactNode;
};

const ReleaseStat = ({label, children, help}: Props) => (
  <Wrapper>
    <Label hasHelp={!!help}>
      {label}
      {help && <StyledQuestionTooltip title={help} size="xs" position="top" />}
    </Label>
    <Value>{children}</Value>
  </Wrapper>
);

const Wrapper = styled('div')`
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    margin: ${space(2)} ${space(4)} ${space(2)} 0;
  }
`;

const Label = styled('div')<{hasHelp: boolean}>`
  font-weight: 600;
  font-size: ${p => p.theme.fontSizeSmall};
  text-transform: uppercase;
  color: ${p => p.theme.gray500};
  line-height: 1.3;
  margin-bottom: ${space(0.25)};
  white-space: nowrap;
  display: flex;
  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    justify-content: flex-end;
  }
`;

const StyledQuestionTooltip = styled(QuestionTooltip)`
  margin-left: ${space(0.5)};
`;

const Value = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  color: ${p => p.theme.gray700};
`;

export default ReleaseStat;
