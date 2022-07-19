import styled from '@emotion/styled';

import space from 'sentry/styles/space';
import type {Color} from 'sentry/utils/theme';

interface ReleaseActivityRowProps {
  children: React.ReactNode;
  icon: React.ReactNode;
  iconColor: Color;
  hideConnector?: boolean;
}

export function ReleaseActivityRow(props: ReleaseActivityRowProps) {
  return (
    <Step>
      {props.hideConnector ? null : <StepConnector />}
      <StepContainer>
        <IconContainer color={props.iconColor}>{props.icon}</IconContainer>
        <StepContent>{props.children}</StepContent>
      </StepContainer>
    </Step>
  );
}

const Step = styled('div')`
  position: relative;
  display: flex;
  align-items: center;
`;

const StepContainer = styled('div')`
  position: relative;
  display: flex;
  align-items: flex-start;
  flex-grow: 1;
`;

const StepContent = styled('div')`
  flex-grow: 1;
  margin-left: ${space(3)};
`;

const StepConnector = styled('div')`
  position: absolute;
  height: 100%;
  top: 28px;
  left: 23px;
  border-right: 1px ${p => p.theme.gray300} dashed;
`;

const IconContainer = styled('div')<{color: Color}>`
  display: flex;
  align-items: center;
  padding: ${space(0.5)} ${space(1.5)};
  width: 48px;
  height: 48px;
  border-radius: 50%;
  background-color: ${p => p.theme[p.color]};
`;
