import {useCallback, useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Button} from 'sentry/components/core/button/';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Flex, Grid} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import {IconArrow, IconCheckmark} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {animations} from 'sentry/views/incidents/styles';
import {
  INCIDENT_SETUP_STEPS,
  INCIDENT_STEP_ORDER,
  IncidentSetupContext,
  IncidentSetupStep,
} from 'sentry/views/incidents/wizard/context';

interface SetupWizardProps {
  onAbandon?: () => void;
  onComplete?: () => void;
}

export function SetupWizard({onComplete}: SetupWizardProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const [stepCtx, setStepCtx] = useState<Omit<IncidentSetupContext, 'setStepContext'>>({
    [IncidentSetupStep.TOOLS]: {
      complete: false,
    },
    [IncidentSetupStep.COMPONENTS]: {
      complete: false,
    },
    [IncidentSetupStep.TEMPLATE]: {
      complete: false,
    },
    [IncidentSetupStep.SMOKEY]: {
      complete: false,
    },
    [IncidentSetupStep.DEMO]: {
      complete: false,
    },
  });

  const currentStepIndex = searchParams.get('step')
    ? Number(searchParams.get('step'))
    : 0;

  const currentStepKey = INCIDENT_STEP_ORDER[currentStepIndex] ?? IncidentSetupStep.TOOLS;
  const currentStep = INCIDENT_SETUP_STEPS[currentStepKey];

  const nextStep =
    currentStepIndex < INCIDENT_STEP_ORDER.length - 1
      ? INCIDENT_STEP_ORDER[currentStepIndex + 1]
      : null;
  const previousStep =
    currentStepIndex > 0 ? INCIDENT_STEP_ORDER[currentStepIndex - 1] : null;

  const completedSteps = Object.values(stepCtx).filter(step => step.complete).length;
  const progressPercentage = (completedSteps / INCIDENT_STEP_ORDER.length) * 100;

  const getStepStatus = useCallback(
    (index: number) => {
      if (stepCtx[INCIDENT_STEP_ORDER[index] as IncidentSetupStep]?.complete)
        return 'complete';
      if (index === currentStepIndex) return 'active';
      return 'inactive';
    },
    [currentStepIndex, stepCtx]
  );

  return (
    <IncidentSetupContext.Provider
      value={{
        ...stepCtx,
        setStepContext: (step, config) => setStepCtx(prev => ({...prev, [step]: config})),
      }}
    >
      <Flex direction="column" gap="lg" radius="md">
        <Flex direction="column" gap="md">
          <Grid
            columns={`repeat(${INCIDENT_STEP_ORDER.length}, 1fr)`}
            gap="md"
            align="center"
          >
            {INCIDENT_STEP_ORDER.map((step, index) => {
              const stepData = INCIDENT_SETUP_STEPS[step];
              return (
                <motion.div
                  key={step}
                  {...animations.moveOver}
                  transition={{
                    ...animations.moveOver.transition,
                    delay: index * 0.3,
                  }}
                >
                  <StepButton
                    onClick={() =>
                      navigate({...location, query: {...location.query, step: index}})
                    }
                    status={getStepStatus(index)}
                  >
                    <div style={{marginBottom: '-2px'}}>
                      <stepData.icon size="md" />
                    </div>
                    <div>
                      <b>{stepData.title}</b>
                    </div>
                  </StepButton>
                </motion.div>
              );
            })}
          </Grid>
          <ProgressBarContainer>
            <ProgressBar
              initial={{width: 0}}
              animate={{width: `${progressPercentage}%`}}
              transition={animations.moveOver.transition}
            />
          </ProgressBarContainer>
        </Flex>
        <Flex direction="column" overflow="hidden" radius="md" border="primary">
          <HeaderContainer>
            <Flex justify="between" align="center" padding="md">
              <Flex direction="column" gap="xs">
                <Heading as="h4" size="xl">
                  {currentStep.title}
                </Heading>
                <Text>{currentStep.description}</Text>
              </Flex>
              <ButtonBar>
                {previousStep !== null && (
                  <Button
                    size="sm"
                    onClick={() =>
                      navigate({
                        ...location,
                        query: {...location.query, step: currentStepIndex - 1},
                      })
                    }
                    icon={<IconArrow direction="left" />}
                  >
                    {t('Previous')}
                  </Button>
                )}
                {nextStep !== null && (
                  <Button
                    size="sm"
                    priority="primary"
                    disabled={!stepCtx[currentStepKey].complete}
                    onClick={() =>
                      navigate({
                        ...location,
                        query: {...location.query, step: currentStepIndex + 1},
                      })
                    }
                    icon={<IconArrow direction="right" />}
                  >
                    {t('Next')}
                  </Button>
                )}
                {currentStepIndex === INCIDENT_STEP_ORDER.length - 1 && (
                  <Button
                    size="sm"
                    priority="primary"
                    onClick={onComplete}
                    icon={<IconCheckmark />}
                  >
                    {t('Finish Setup')}
                  </Button>
                )}
              </ButtonBar>
            </Flex>
          </HeaderContainer>
          <ContentContainer>
            <Flex direction="column" gap="lg" padding="xl">
              <AnimatePresence mode="wait">
                <motion.div key={currentStepIndex} {...animations.moveOver}>
                  <currentStep.content />
                </motion.div>
              </AnimatePresence>
            </Flex>
          </ContentContainer>
        </Flex>
      </Flex>
    </IncidentSetupContext.Provider>
  );
}

const HeaderContainer = styled('div')`
  padding: ${p => p.theme.space.md};
  background: ${p => p.theme.backgroundSecondary};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const ContentContainer = styled('div')`
  grid-column: 2 / 3;
  grid-row: 2 / 3;
  padding: ${p => `${p.theme.space.xl} ${p.theme.space.lg}`};
`;

const StepButton = styled('button')<{status: 'active' | 'inactive' | 'complete'}>`
  outline: 0;
  cursor: pointer;
  border: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${p => `${p.theme.space.md} ${p.theme.space.lg}`};
  text-align: center;
  width: 100%;
  &:hover {
    background: ${p => p.theme.backgroundSecondary};
  }
  transition: background 0.1s ease-in-out;
  ${p =>
    p.status === 'active' &&
    css`
      border-color: ${p.theme.tokens.graphics.accent};
      color: ${p.theme.tokens.graphics.accent};
    `}

  ${p =>
    p.status === 'complete' &&
    css`
      border-color: ${p.theme.tokens.graphics.success};
      color: ${p.theme.tokens.graphics.success};
      background: ${p.theme.green100};
    `}
`;

const ProgressBarContainer = styled('div')`
  width: 100%;
  margin-top: 4px;
  height: 4px;
  background: ${p => p.theme.backgroundSecondary};
  border-radius: 2px;
  overflow: hidden;
`;

const ProgressBar = styled(motion.div)`
  height: 100%;
  background: ${p => p.theme.tokens.graphics.success};
`;
