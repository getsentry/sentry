import {useEffect} from 'react';
import {IconBot} from '@sentry/icons/bot';
import {IconGraph} from '@sentry/icons/graph';
import {IconProfiling} from '@sentry/icons/profiling';
import {IconSeer} from '@sentry/icons/seer';
import {IconSpan} from '@sentry/icons/span';
import {IconTerminal} from '@sentry/icons/terminal';
import {IconTimer} from '@sentry/icons/timer';
import {IconWarning} from '@sentry/icons/warning';
import {AnimatePresence, motion} from 'framer-motion';

import {FeatureBadge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {SCM_STEP_CONTENT_WIDTH} from 'sentry/components/onboarding/consts';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useOnboardingAgentSetupRun} from 'sentry/views/onboarding/agenticProgress/useOnboardingAgentSetupRun';
import {ONBOARDING_ENTER, ONBOARDING_STAGGER} from 'sentry/views/onboarding/animations';
import {
  NewWelcomeProductCard,
  type ProductOption,
} from 'sentry/views/onboarding/components/newWelcomeProductCard';
import {WelcomeAgentSetup} from 'sentry/views/onboarding/components/welcomeAgentSetup';
import {OnboardingWelcomeProductId, type StepProps} from 'sentry/views/onboarding/types';
import {useWelcomeAnalyticsEffect} from 'sentry/views/onboarding/useWelcomeAnalyticsEffect';
import {useWelcomeHandleComplete} from 'sentry/views/onboarding/useWelcomeHandleComplete';

const MotionContainer = motion.create(Container);
const MotionFlex = motion.create(Flex);
const MotionStack = motion.create(Stack);
const MotionGrid = motion.create(Grid);

// Product options in display order (3x2 grid: row1: Error, Logging, Session; row2: Metrics, Tracing, Profiling)
const PRODUCT_OPTIONS: ProductOption[] = [
  {
    id: OnboardingWelcomeProductId.ERROR_MONITORING,
    icon: <IconWarning size="md" variant="secondary" />,
    title: t('Error monitoring'),
    description: t('Automatically capture exceptions and stack traces.'),
  },
  {
    id: OnboardingWelcomeProductId.LOGGING,
    icon: <IconTerminal size="md" variant="secondary" />,
    title: t('Logging'),
    description: t('See logs in context with errors and performance issues.'),
  },
  {
    id: OnboardingWelcomeProductId.SESSION_REPLAY,
    icon: <IconTimer size="md" variant="secondary" />,
    title: t('Session replay'),
    description: t('Watch real user sessions to see what went wrong.'),
  },
  {
    id: OnboardingWelcomeProductId.TRACING,
    icon: <IconSpan size="md" variant="secondary" />,
    title: t('Tracing'),
    description: t('Find bottlenecks, broken requests, and understand flows end-to-end.'),
  },
  {
    id: OnboardingWelcomeProductId.METRICS,
    icon: <IconGraph size="md" variant="secondary" />,
    title: t('Application Metrics'),
    description: t(
      'Track application performance and usage over time with custom metrics.'
    ),
  },
  {
    id: OnboardingWelcomeProductId.PROFILING,
    icon: <IconProfiling size="md" variant="secondary" />,
    title: t('Profiling'),
    description: t(
      'Pinpoint the functions and lines of code responsible for performance issues.'
    ),
  },
  {
    id: OnboardingWelcomeProductId.AGENT_MONITORING,
    icon: <IconBot size="md" variant="secondary" />,
    title: t('Agent monitoring'),
    description: t(
      'Track all agent runs, error rates, LLM calls, tokens used, and tool executions.'
    ),
  },
  {
    id: OnboardingWelcomeProductId.SEER,
    icon: <IconSeer size="md" variant="secondary" />,
    title: t('Seer'),
    description: t(
      'Catch breaking changes, automatically root cause issues in production, and fix what you missed.'
    ),
    badge: <FeatureBadge type="new" tooltipProps={{disabled: true}} />,
  },
];

function getAgentHeading({
  hasRunFailed,
  isSetupComplete,
}: {
  hasRunFailed: boolean;
  isSetupComplete: boolean;
}) {
  if (hasRunFailed) {
    return {
      title: t('Setup Didn’t Finish'),
      description: t(
        'Your agent ran into a problem. You can pick up where it left off manually below.'
      ),
    };
  }

  if (isSetupComplete) {
    return {
      title: t("You're All Set"),
      description: t(
        'Sentry is watching your app. Anything it catches from here shows up in Issues.'
      ),
    };
  }

  return {
    title: t('Agent Connected'),
    description: t(
      'Your agent is setting up Sentry in your application. For now, you’re off the hook. Sit back and let it do the work.'
    ),
  };
}

export function NewWelcomeUI(props: StepProps) {
  const organization = useOrganization();
  const showAgentSetup = organization.features.includes('onboarding-agentic-setup');
  const {
    run,
    onboardingCode,
    isAgentConnected,
    isSetupComplete,
    hasRunFailed,
    hasInitFailed,
    hasProgressFailed,
    refreshRun,
    restartRun,
  } = useOnboardingAgentSetupRun({enabled: showAgentSetup});
  const showAgentHeading =
    showAgentSetup && (isAgentConnected || isSetupComplete || hasRunFailed);
  const scmHeading = showAgentHeading
    ? getAgentHeading({hasRunFailed, isSetupComplete})
    : {
        title: t("Code breaks.\nWe'll help you fix it faster"),
        description: t('Monitor, debug, and fix your code, all in one place.'),
      };

  useWelcomeAnalyticsEffect({showAgentSetup});

  // Scroll to top on mount to fix iOS Safari retaining scroll position from previous page.
  // Skip if there's a hash in the URL to avoid conflicting with anchor-based scrolling.
  useEffect(() => {
    if (!window.location.hash) {
      window.scrollTo(0, 0);
    }
  }, []);

  const handleComplete = useWelcomeHandleComplete(props.onComplete);

  const handleCopyCommand = (source: 'install_command' | 'prompt') => {
    trackAnalytics('onboarding.scm_welcome_agent_command_copied', {organization, source});
  };

  const handleSelectSnippet = (source: 'install_command' | 'prompt') => {
    trackAnalytics('onboarding.scm_welcome_agent_snippet_selected', {
      organization,
      source,
    });
  };

  return (
    <MotionContainer
      width="100%"
      margin="0 auto"
      maxWidth={SCM_STEP_CONTENT_WIDTH}
      position="relative"
    >
      <MotionFlex direction="column" align="center" {...ONBOARDING_STAGGER}>
        <Stack gap="3xl" align="center" width="100%">
          <MotionStack gap="md" width="100%" {...ONBOARDING_STAGGER}>
            <Stack gap="lg" paddingBottom="xl">
              <MotionContainer {...ONBOARDING_ENTER}>
                <Heading as="h2" size="3xl" align="center" wrap="pre-line">
                  {scmHeading.title}
                </Heading>
              </MotionContainer>
              <MotionContainer {...ONBOARDING_ENTER}>
                <Text align="center" variant="muted" size="lg" density="comfortable">
                  {scmHeading.description}
                </Text>
              </MotionContainer>
            </Stack>
          </MotionStack>

          {/* Let the onboarding step's exit animate through this nested boundary. */}
          <AnimatePresence mode="wait" initial={false} propagate>
            {showAgentSetup ? (
              // Swaps in after the stagger has run, so it drives the variants
              // itself rather than inheriting the step's.
              <MotionContainer
                key="agent-setup"
                width="100%"
                initial="initial"
                animate="animate"
                exit="exit"
                {...ONBOARDING_ENTER}
              >
                <WelcomeAgentSetup
                  hasInitFailed={hasInitFailed}
                  hasProgressFailed={hasProgressFailed}
                  onRefresh={() => void refreshRun()}
                  isAgentConnected={isAgentConnected}
                  onboardingCode={onboardingCode}
                  onCopyCommand={handleCopyCommand}
                  onRetry={restartRun}
                  onSelectSnippet={handleSelectSnippet}
                  onSetupInBrowser={handleComplete}
                  run={run}
                />
              </MotionContainer>
            ) : (
              <MotionStack key="products" gap="3xl" width="100%" {...ONBOARDING_STAGGER}>
                <MotionGrid
                  columns={{zero: '1fr', xl: 'repeat(2, 1fr)'}}
                  gap="3xl"
                  width="100%"
                  {...ONBOARDING_ENTER}
                  border="primary"
                  background="primary"
                  radius="xl"
                  padding="xl"
                >
                  {PRODUCT_OPTIONS.map(product => (
                    <NewWelcomeProductCard key={product.id} product={product} />
                  ))}
                </MotionGrid>

                <MotionFlex {...ONBOARDING_ENTER} width="100%" justify="center">
                  <Button
                    variant="primary"
                    onClick={handleComplete}
                    data-test-id="onboarding-welcome-start"
                  >
                    {t('Let’s get started')}
                  </Button>
                </MotionFlex>
              </MotionStack>
            )}
          </AnimatePresence>
        </Stack>
      </MotionFlex>
    </MotionContainer>
  );
}
