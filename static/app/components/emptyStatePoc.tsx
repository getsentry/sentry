import {useState} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import waitingForEventImg from 'sentry-images/spot/waiting-for-event.svg';

import {Button} from 'sentry/components/button';
import {CodeSnippet} from 'sentry/components/codeSnippet';
import {IconCheckmark} from 'sentry/icons';
import pulsingIndicatorStyles from 'sentry/styles/pulsingIndicator';
import {space} from 'sentry/styles/space';

export default function UpdatedEmptyState() {
  const [step, setStep] = useState(1);

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
          <BodyTitle>Set up Python SDK</BodyTitle>
          <StepWrapper>
            <SubStepWrapper>
              <StepConnector isCurrentStep={step === 1} />
              <Step>
                <CircledNumber isCurrentStep={step === 1}>1</CircledNumber>
                <div>
                  <StepHeader>
                    <StepTitle isCurrentStep={step === 1}>Install Sentry</StepTitle>
                    {step > 1 && <IconCheckmark size="sm" />}
                  </StepHeader>
                  {step === 1 && (
                    <StepBody>
                      <StepDescription>
                        Use the following command to install our Python SDK
                      </StepDescription>
                      <CodeSnippet language="python">
                        pip install --upgrade sentry-sdk
                      </CodeSnippet>
                      <StepButton onClick={() => setStep(2)}>Next</StepButton>
                    </StepBody>
                  )}
                </div>
              </Step>
            </SubStepWrapper>
            <SubStepWrapper>
              <StepConnector isCurrentStep={step === 2} />
              <Step>
                <CircledNumber isCurrentStep={step === 2}>2</CircledNumber>
                <div>
                  <StepHeader>
                    <StepTitle isCurrentStep={step === 2}>Configure</StepTitle>
                    {step > 2 && <IconCheckmark size="sm" />}
                  </StepHeader>
                  {step === 2 && (
                    <StepBody>
                      <StepDescription>
                        Add the following code to your application, as early in the
                        lifecycle as possible.
                      </StepDescription>
                      <CodeSnippet language="python">
                        {`import sentry_sdk
sentry_sdk.init(dsn="http://dc21aeced16ec1aaee075661e7a063f0@localhost:8000/18",
enable_tracing=True)`}
                      </CodeSnippet>
                      <StepButton onClick={() => setStep(1)}>Back</StepButton>
                      <StepButton onClick={() => setStep(3)}>Next</StepButton>
                    </StepBody>
                  )}
                </div>
              </Step>
            </SubStepWrapper>
            <SubStepWrapper>
              <Step>
                <CircledNumber isCurrentStep={step === 3}>3</CircledNumber>
                <div>
                  <StepHeader>
                    <StepTitle isCurrentStep={step === 3}>Verify</StepTitle>
                  </StepHeader>
                  {step === 3 && (
                    <StepBody>
                      <StepDescription>
                        Add this intentional error to your application to test that
                        everything is working right away.
                      </StepDescription>
                      <CodeSnippet language="python">
                        division_by_zero = 1 / 0
                      </CodeSnippet>
                      <StatusWrapper>
                        <WaitingIndicator />
                        <WaitingText>Waiting for first event</WaitingText>
                      </StatusWrapper>
                      <StepButton onClick={() => setStep(2)}>Back</StepButton>
                    </StepBody>
                  )}
                </div>
              </Step>
            </SubStepWrapper>
          </StepWrapper>
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

const StepWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
`;

const StepTitle = styled('div')<{isCurrentStep: boolean}>`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  font-weight: 600;
  color: ${p => (p.isCurrentStep ? p.theme.gray500 : p.theme.gray300)};
`;

const StepDescription = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
`;

const StepBody = styled('div')`
  width: 100%;
`;

const Arcade = styled('iframe')`
  width: 600px;
  max-width: 100%;
  height: 440px;
  border: 0;
`;

const CircledNumber = styled('div')<{isCurrentStep: boolean}>`
  width: 24px;
  height: 24px;
  border-radius: 50%;
  color: ${p => (p.isCurrentStep ? 'white' : p.theme.gray300)};
  background-color: ${p => (p.isCurrentStep ? p.theme.purple300 : p.theme.gray100)};
  display: flex;
  justify-content: center;
  align-items: center;
  font-size: 12px;
`;

const StepHeader = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: ${space(1)};
`;

const StepButton = styled(Button)`
  margin-top: ${space(1)};
  margin-bottom: ${space(1)};
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

const StepConnector = styled('div')<{isCurrentStep: boolean}>`
  position: absolute;
  height: ${p => (p.isCurrentStep ? '85%' : '40%')};
  top: 30px;
  left: 11px;
  border: 1px ${p => p.theme.border} solid;
`;

const Step = styled('div')`
  display: flex;
  flex-direction: row;
  align-items: flex-start;
  gap: ${space(2)};
`;

const SubStepWrapper = styled('div')`
  position: relative;
  display: flex;
  align-items: flex-start;
`;
