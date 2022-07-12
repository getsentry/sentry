import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import {Panel, PanelBody} from 'sentry/components/panels';
import TimeSince from 'sentry/components/timeSince';
import {IconExclamation, IconSentry} from 'sentry/icons';
import space from 'sentry/styles/space';
import type {Color} from 'sentry/utils/theme';

export default function ReleaseActivity() {
  return (
    <Layout.Body>
      <Layout.Main fullWidth>
        <ActivityList>
          <Step>
            <StepConnector />

            <StepContainer>
              <div>
                <IconContainer color="yellow300">
                  <IconExclamation color="white" size="lg" />
                </IconContainer>
              </div>

              <StepContent>
                <PanelBody withPadding>
                  <div>New Issue</div>
                  <DateContainer>
                    <TimeSince date={new Date()} />
                  </DateContainer>
                </PanelBody>
              </StepContent>
            </StepContainer>
          </Step>
          <Step>
            <StepConnector />

            <StepContainer>
              <div>
                <IconContainer color="yellow300">
                  <IconExclamation color="white" size="lg" />
                </IconContainer>
              </div>

              <StepContent>
                <PanelBody withPadding>
                  <div>New Issue</div>
                  <DateContainer>
                    <TimeSince date={new Date()} />
                  </DateContainer>
                </PanelBody>
              </StepContent>
            </StepContainer>
          </Step>
          <Step>
            <StepContainer>
              <IconContainer color="gray500">
                <IconSentry color="white" size="lg" />
              </IconContainer>

              <StepContent>
                <PanelBody withPadding>
                  <div>Waiting for issues in this release...</div>
                </PanelBody>
              </StepContent>
            </StepContainer>
          </Step>
        </ActivityList>
      </Layout.Main>
    </Layout.Body>
  );
}

const ActivityList = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

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

const StepContent = styled(Panel)`
  flex-grow: 1;
  margin-left: ${space(1)};
  margin-bottom: 0;
`;

const StepConnector = styled('div')`
  position: absolute;
  height: 100%;
  top: 28px;
  left: 23px;
  border-right: 1px ${p => p.theme.gray200} dashed;
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

const DateContainer = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
`;
