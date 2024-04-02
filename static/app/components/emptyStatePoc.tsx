import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import waitingForEventImg from 'sentry-images/spot/waiting-for-event.svg';

import {Button} from 'sentry/components/button';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import {GuidedSteps} from 'sentry/components/guidedSteps/guidedSteps';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import {space} from 'sentry/styles/space';

export default function UpdatedEmptyState() {
  return (
    <div>
      <HeaderWrapper>
        <Title>Get Started with Sentry Issues</Title>
        <Description>Your code sleuth eagerly awaits its first mission.</Description>
        <Image src={waitingForEventImg} />
      </HeaderWrapper>
      <Divider />
      <Body>
        <Setup>
          <GuidedSteps>
            <GuidedSteps.Step title="Install Sentry">
              Use the following command to install our Python SDK
              <CodeSnippet language="python">
                pip install --upgrade sentry-sdk
              </CodeSnippet>
              <GuidedSteps.StepButtons />
            </GuidedSteps.Step>
            <GuidedSteps.Step title="Install Sentry">
              Add the following code to your application, as early in the lifecycle as
              possible.
              <CodeSnippet language="python">
                {`import sentry_sdk
sentry_sdk.init(dsn="http://dc21aeced16ec1aaee075661e7a063f0@localhost:8000/18",
enable_tracing=True)`}
              </CodeSnippet>
              <GuidedSteps.StepButtons />
            </GuidedSteps.Step>
            <GuidedSteps.Step title="Verify">
              Add this intentional error to your application to test that everything is
              working right away.
              <CodeSnippet language="python">division_by_zero = 1 / 0</CodeSnippet>
              <StatusWrapper>
                <WaitingIndicator />
                <WaitingText>Waiting for first event</WaitingText>
              </StatusWrapper>
              <GuidedSteps.StepButtons />
            </GuidedSteps.Step>
          </GuidedSteps>
        </Setup>
        <Preview>
          <BodyTitle>Preview Sentry Issue</BodyTitle>
          <Button>View Sample Event</Button>
          <ArcadeWrapper>
            <Arcade
              src="https://demo.arcade.software/LjEJ1sfLaVRdtOs3mri1?embed"
              loading="lazy"
              allowFullScreen
            />
          </ArcadeWrapper>
        </Preview>
      </Body>
    </div>
  );
}

const Title = styled('div')`
  font-size: 26px;
  font-weight: 600;
`;

const Description = styled('div')`
  max-width: 340px;
`;

const ArcadeWrapper = styled('div')`
  margin-top: ${space(1)};
`;

const HeaderWrapper = styled('div')`
  border-radius: ${p => p.theme.borderRadius};
  padding: ${space(4)};
`;

const BodyTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: 600;
  margin-bottom: ${space(1)};
`;

const Setup = styled('div')`
  padding: ${space(4)};
  flex-basis: 100%;
  width: 50%;

  &:after {
    content: '';
    position: absolute;
    right: 50%;
    top: 19%;
    height: 78%;
    border-right: 1px ${p => p.theme.border} solid;
  }
`;

const Preview = styled('div')`
  padding: ${space(4)};
  flex-basis: 100%;
  width: 50%;
`;

const Body = styled('div')`
  display: flex;
  flex-direction: row;
`;

const Image = styled('img')`
  position: absolute;
  display: block;
  top: 0px;
  right: 20px;
  pointer-events: none;
  height: 120px;
  overflow: hidden;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: none;
  }
`;

const Divider = styled('hr')`
  height: 1px;
  width: 95%;
  background: ${p => p.theme.border};
  border: none;
  margin-top: 0;
  margin-bottom: 0;
`;

const Arcade = styled('iframe')`
  width: 600px;
  max-width: 100%;
  height: 440px;
  border: 0;
`;

const StatusWrapper = styled('div')`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
  align-items: center;
`;

const WaitingIndicator = styled(motion.div)`
  margin: 0 6px;
  ${pulsingIndicatorStyles};
`;

const WaitingText = styled('div')`
  color: ${p => p.theme.pink300};
`;
