import {useEffect} from 'react';
import {AnimatePresence, motion, type MotionProps} from 'framer-motion';

import {FeatureBadge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {
  IconBot,
  IconGraph,
  IconProfiling,
  IconSeer,
  IconSpan,
  IconTerminal,
  IconTimer,
  IconWarning,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  NewWelcomeProductCard,
  type ProductOption,
} from 'sentry/views/onboarding/components/newWelcomeProductCard';
import {
  useWelcomeAgentRun,
  WelcomeAgentSetup,
} from 'sentry/views/onboarding/components/welcomeAgentSetup';
import {ONBOARDING_WELCOME_STAGGER_ITEM} from 'sentry/views/onboarding/consts';
import {OnboardingWelcomeProductId, type StepProps} from 'sentry/views/onboarding/types';
import {useWelcomeAnalyticsEffect} from 'sentry/views/onboarding/useWelcomeAnalyticsEffect';
import {useWelcomeHandleComplete} from 'sentry/views/onboarding/useWelcomeHandleComplete';

const MotionContainer = motion.create(Container);
const MotionFlex = motion.create(Flex);
const MotionStack = motion.create(Stack);
const MotionGrid = motion.create(Grid);

const STAGGER_CONTAINER: MotionProps = {
  initial: 'initial',
  animate: 'animate',
  exit: 'exit',
  transition: {
    staggerChildren: 0.125,
    delayChildren: 0.075,
    duration: 0.25,
    ease: 'easeOut',
  },
  variants: {
    exit: {
      transition: {
        staggerChildren: 0.05,
        delayChildren: 0.0125,
      },
    },
  },
};

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
    restartRun,
  } = useWelcomeAgentRun({enabled: showAgentSetup});
  const showAgentHeading = showAgentSetup && isAgentConnected;
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
    <MotionContainer width="100%" margin="0 auto" maxWidth="900px" position="relative">
      <MotionFlex direction="column" align="center" {...STAGGER_CONTAINER}>
        <Stack gap="3xl" align="center" width="100%">
          <MotionStack gap="md" {...ONBOARDING_WELCOME_STAGGER_ITEM} width="100%">
            <Stack gap="lg">
              <Heading as="h2" size="4xl" wrap="pre-line">
                {scmHeading.title}
              </Heading>
              <Text variant="muted" size="xl" density="comfortable">
                {scmHeading.description}
              </Text>
            </Stack>
          </MotionStack>

          {/* Let the onboarding step's exit animate through this nested boundary. */}
          <AnimatePresence mode="wait" initial={false} propagate>
            {showAgentSetup ? (
              // The agent setup swaps in after the stagger has already run, so it
              // drives the shared variants itself rather than inheriting them.
              // Declaring `animate` makes it a variant root, which also stops the
              // step-level exit label from propagating in — hence the explicit exit.
              <MotionContainer
                key="agent-setup"
                width="100%"
                initial="initial"
                animate="animate"
                exit="exit"
                {...ONBOARDING_WELCOME_STAGGER_ITEM}
              >
                <WelcomeAgentSetup
                  hasInitFailed={hasInitFailed}
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
              <MotionStack
                key="products"
                gap="3xl"
                width="100%"
                transition={{staggerChildren: 0.125}}
              >
                <MotionGrid
                  columns={{'screen:xs': '1fr', 'screen:sm': 'repeat(3, 1fr)'}}
                  gap="3xl"
                  width="100%"
                  {...ONBOARDING_WELCOME_STAGGER_ITEM}
                  border="muted"
                  background="secondary"
                  radius="lg"
                  padding="2xl"
                >
                  {PRODUCT_OPTIONS.map(product => (
                    <NewWelcomeProductCard key={product.id} product={product} />
                  ))}
                </MotionGrid>

                <MotionFlex
                  {...ONBOARDING_WELCOME_STAGGER_ITEM}
                  width="100%"
                  justify="end"
                >
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
