import {useEffect} from 'react';
import {motion, type MotionProps} from 'framer-motion';

import {FeatureBadge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {
  IconBot,
  IconCheckmark,
  IconGraph,
  IconLightning,
  IconProfiling,
  IconSeer,
  IconSpan,
  IconTerminal,
  IconTimer,
  IconWarning,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useExperiment} from 'sentry/utils/useExperiment';
import {GenericFooter} from 'sentry/views/onboarding/components/genericFooter';
import {
  NewWelcomeProductCard,
  type ProductOption,
} from 'sentry/views/onboarding/components/newWelcomeProductCard';
import {WelcomeBackgroundNewUi} from 'sentry/views/onboarding/components/welcomeBackground';
import {WelcomeSkipButton} from 'sentry/views/onboarding/components/welcomeSkipButton';
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
    description: t('Automatically capture exceptions and stack traces'),
  },
  {
    id: OnboardingWelcomeProductId.LOGGING,
    icon: <IconTerminal size="md" variant="secondary" />,
    title: t('Logging'),
    description: t('See logs in context with errors and performance issues'),
  },
  {
    id: OnboardingWelcomeProductId.SESSION_REPLAY,
    icon: <IconTimer size="md" variant="secondary" />,
    title: t('Session replay'),
    description: t('Watch real user sessions to see what went wrong'),
  },
  {
    id: OnboardingWelcomeProductId.TRACING,
    icon: <IconSpan size="md" variant="secondary" />,
    title: t('Tracing'),
    description: t(
      'Find bottlenecks, broken requests, and understand application flow end-to-end.'
    ),
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

export function NewWelcomeUI(props: StepProps) {
  const {inExperiment: hasScmOnboarding} = useExperiment({
    feature: 'onboarding-scm-experiment',
    reportExposure: false,
  });

  useWelcomeAnalyticsEffect();

  // Scroll to top on mount to fix iOS Safari retaining scroll position from previous page.
  // Skip if there's a hash in the URL to avoid conflicting with anchor-based scrolling.
  useEffect(() => {
    if (!window.location.hash) {
      window.scrollTo(0, 0);
    }
  }, []);

  const handleComplete = useWelcomeHandleComplete(props.onComplete);

  return (
    <MotionContainer width="100%" margin="0 auto" maxWidth="900px" position="relative">
      <MotionFlex direction="column" align="center" {...STAGGER_CONTAINER}>
        <WelcomeBackgroundNewUi />
        <Stack gap="3xl" align={hasScmOnboarding ? 'start' : 'center'} width="100%">
          <MotionStack gap="md" {...ONBOARDING_WELCOME_STAGGER_ITEM} width="100%">
            {hasScmOnboarding ? (
              <Stack gap="lg">
                <Heading as="h2" size="4xl" wrap="pre-line">
                  {t("Code breaks.\nWe'll help you fix it faster")}
                </Heading>
                <Text variant="muted" size="xl" density="comfortable">
                  {t('Monitor, debug, and fix your code, all in one place.')}
                </Text>
              </Stack>
            ) : (
              <Flex direction="column" gap="sm" paddingBottom="2xl">
                <Container>
                  <Heading as="h1" density="comfortable">
                    {t('Welcome to Sentry')}
                  </Heading>
                </Container>
                <Container>
                  <Text variant="muted" size="xl" bold wrap="pre-line">
                    {t("Your code is probably broken. Let's fix it faster.")}
                  </Text>
                </Container>
              </Flex>
            )}

            {hasScmOnboarding ? null : (
              <Stack gap="2xs">
                <Flex align="center" gap="md">
                  <Container>
                    <IconLightning size="md" variant="accent" />
                  </Container>
                  <Container>
                    <Text size="lg" bold density="comfortable">
                      {t(
                        "You've got 14 days of Business with unlimited access to everything below."
                      )}
                    </Text>
                  </Container>
                </Flex>
                <Container>
                  <Text size="md" variant="muted">
                    {t(
                      "We'll walk you through setup next. Start with what matters now, add the rest when you're ready."
                    )}
                  </Text>
                </Container>
              </Stack>
            )}
          </MotionStack>

          <MotionGrid
            columns={{xs: '1fr', md: 'repeat(3, 1fr)'}}
            gap="3xl"
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

          {hasScmOnboarding ? (
            <MotionFlex {...ONBOARDING_WELCOME_STAGGER_ITEM} width="100%" justify="end">
              <Button
                variant="primary"
                onClick={handleComplete}
                data-test-id="onboarding-welcome-start"
              >
                {t('Let’s get started')}
              </Button>
            </MotionFlex>
          ) : (
            <MotionContainer {...ONBOARDING_WELCOME_STAGGER_ITEM}>
              <Flex align="center" gap="md" justify="center">
                <IconCheckmark size="md" variant="success" />
                <Text size="md" variant="muted">
                  {t(
                    "After the trial ends, you'll move to our free plan. You will not be charged for any usage, promise."
                  )}
                </Text>
              </Flex>
            </MotionContainer>
          )}
        </Stack>
        {hasScmOnboarding ? null : (
          <GenericFooter gap="3xl" padding="0 3xl">
            <Flex align="center">
              <WelcomeSkipButton asButton>{t('Skip onboarding')}</WelcomeSkipButton>
            </Flex>

            <Flex align="center">
              <Button
                variant="primary"
                onClick={handleComplete}
                data-test-id="onboarding-welcome-start"
              >
                {t('Begin setup')}
              </Button>
            </Flex>
          </GenericFooter>
        )}
      </MotionFlex>
    </MotionContainer>
  );
}
