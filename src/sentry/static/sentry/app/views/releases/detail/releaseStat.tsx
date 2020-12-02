import React from 'react';
import styled from '@emotion/styled';

import QuestionTooltip from 'app/components/questionTooltip';
import space from 'app/styles/space';

type Props = {
  label: string;
  children: React.ReactNode;
  help?: React.ReactNode;
};

const ReleaseStat = ({label, children, help}: Props) => (
  <Wrapper>
    <Label>
      {label}
      {help && <StyledQuestionTooltip title={help} size="xs" position="bottom" />}
    </Label>
    <Value>{children}</Value>
  </Wrapper>
);

const Wrapper = styled('div')`
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    margin: ${space(2)} ${space(4)} ${space(2)} 0;
  }
`;

const Label = styled('div')`
  font-weight: 600;
  font-size: ${p => p.theme.fontSizeSmall};
  text-transform: uppercase;
  color: ${p => p.theme.gray300};
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
  color: ${p => p.theme.textColor};
`;

export default ReleaseStat;
