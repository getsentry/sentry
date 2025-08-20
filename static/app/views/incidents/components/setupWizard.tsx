import React, {useCallback, useState} from 'react';
import {useSearchParams} from 'react-router-dom';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import {AnimatePresence, motion} from 'framer-motion';

import {Button} from 'sentry/components/core/button/';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {Flex, Grid} from 'sentry/components/core/layout';
import {Heading, Text} from 'sentry/components/core/text';
import {
  IconArrow,
  IconChat,
  IconCheckmark,
  IconFix,
  IconLightning,
  IconRuler,
  IconSettings,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {ComponentStep} from 'sentry/views/incidents/components/componentStep';
import {DemoStep} from 'sentry/views/incidents/components/demoStep';
import {SmokeyStep} from 'sentry/views/incidents/components/smokeyStep';
import {TemplateStep} from 'sentry/views/incidents/components/templateStep';
import {ToolStep} from 'sentry/views/incidents/components/toolStep';
import {animations} from 'sentry/views/incidents/styles';

interface SetupWizardProps {
  onAbandon?: () => void;
  onComplete?: () => void;
}

interface SetupStep {
  content: React.ComponentType<any>;
  description: string;
  icon: React.ComponentType<any>;
  title: string;
}

interface SetupStepConfig {
  complete: boolean;
  config: Record<string, any>;
}

enum IncidentSetupStep {
  TOOLS = 'tools',
  COMPONENTS = 'components',
  TEMPLATE = 'template',
  SMOKEY = 'smokey',
  DEMO = 'demo',
}

const INCIDENT_STEP_ORDER: IncidentSetupStep[] = [
  IncidentSetupStep.TOOLS,
  IncidentSetupStep.COMPONENTS,
  IncidentSetupStep.TEMPLATE,
  IncidentSetupStep.SMOKEY,
  IncidentSetupStep.DEMO,
];

const INCIDENT_SETUP_STEPS: Record<IncidentSetupStep, SetupStep> = {
  [IncidentSetupStep.TOOLS]: {
    title: t('Connect Your Tools'),
    description: t(
      'Integrate your whole workflow now so you can focus on fighting fires later.'
    ),
    icon: IconSettings,
    content: ToolStep,
  },
  [IncidentSetupStep.COMPONENTS]: {
    title: t('Add Components'),
    description: t(
      'What are the key parts of your appplication or services that can break?'
    ),
    icon: IconFix,
    content: ComponentStep,
  },
  [IncidentSetupStep.TEMPLATE]: {
    title: t('Setup a Template'),
    description: t('Connect tools to template + other template configuration'),
    icon: IconRuler,
    content: TemplateStep,
  },
  [IncidentSetupStep.SMOKEY]: {
    title: t('Meet Smokey'),
    description: t('Say hello to our interactive agent for incident management'),
    icon: IconChat,
    content: SmokeyStep,
  },
  [IncidentSetupStep.DEMO]: {
    title: t('Test It Out'),
    description: t('Create a demo incident to verify your setup'),
    icon: IconLightning,
    content: DemoStep,
  },
};

export function SetupWizard({onComplete}: SetupWizardProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [stepConfig, setStepConfig] = useState<
    Record<IncidentSetupStep, SetupStepConfig>
  >({
    [IncidentSetupStep.TOOLS]: {
      complete: false,
      config: {},
    },
    [IncidentSetupStep.COMPONENTS]: {
      complete: false,
      config: {},
    },
    [IncidentSetupStep.TEMPLATE]: {
      complete: false,
      config: {},
    },
    [IncidentSetupStep.SMOKEY]: {
      complete: false,
      config: {},
    },
    [IncidentSetupStep.DEMO]: {
      complete: false,
      config: {},
    },
  });

  const currentStepIndex = searchParams.get('step')
    ? Number(searchParams.get('step'))
    : 0;

  const currentStep =
    INCIDENT_SETUP_STEPS[
      INCIDENT_STEP_ORDER[currentStepIndex] ?? IncidentSetupStep.TOOLS
    ];

  const nextStep =
    currentStepIndex < INCIDENT_STEP_ORDER.length - 1
      ? INCIDENT_STEP_ORDER[currentStepIndex + 1]
      : null;
  const previousStep =
    currentStepIndex > 0 ? INCIDENT_STEP_ORDER[currentStepIndex - 1] : null;

  const completedSteps = Object.values(stepConfig).filter(step => step.complete).length;
  const progressPercentage = (completedSteps / INCIDENT_STEP_ORDER.length) * 100;

  const getStepStatus = useCallback(
    (index: number) => {
      if (index === currentStepIndex) return 'active';
      if (stepConfig[INCIDENT_STEP_ORDER[index] as IncidentSetupStep]?.complete)
        return 'complete';
      return 'inactive';
    },
    [currentStepIndex, stepConfig]
  );

  return (
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
                  disabled={nextStep === null}
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
                <currentStep.content
                  onComplete={(config: Record<string, any>) =>
                    setStepConfig(prev => ({
                      ...prev,
                      [currentStepIndex]: {complete: true, config},
                    }))
                  }
                />
              </motion.div>
            </AnimatePresence>
          </Flex>
        </ContentContainer>
      </Flex>
    </Flex>
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
