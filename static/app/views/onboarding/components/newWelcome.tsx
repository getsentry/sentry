import {useEffect} from 'react';
import {motion, type MotionProps} from 'framer-motion';

import {FeatureBadge} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {
  IconBot,
  IconBusiness,
  IconGraph,
  IconProfiling,
  IconSeer,
  IconSpan,
  IconTerminal,
  IconTimer,
  IconWarning,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import testableTransition from 'sentry/utils/testableTransition';
import GenericFooter from 'sentry/views/onboarding/components/genericFooter';
import {
  NewWelcomeProductCard,
  type ProductOption,
} from 'sentry/views/onboarding/components/newWelcomeProductCard';
import {NewWelcomeSeerExtra} from 'sentry/views/onboarding/components/newWelcomeSeerExtra';
import {NewWelcomeSeerFlag} from 'sentry/views/onboarding/components/newWelcomeSeerFlag';
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
  variants: {
    initial: {},
    animate: {
      transition: testableTransition({
        staggerChildren: 0.1,
        delayChildren: 0.1,
      }),
    },
    exit: {},
  },
};

const STAGGER_CHILDREN = {
  initial: {},
  animate: {
    transition: testableTransition({
      staggerChildren: 0.08,
    }),
  },
};

// Product options in display order (3x2 grid: row1: Error, Logging, Session; row2: Metrics, Tracing, Profiling)
const PRODUCT_OPTIONS: ProductOption[] = [
  {
    id: OnboardingWelcomeProductId.ERROR_MONITORING,
    icon: <IconWarning legacySize="16px" variant="secondary" />,
    title: t('Error monitoring'),
    description: t('Automatically capture exceptions and stack traces'),
  },
  {
    id: OnboardingWelcomeProductId.LOGGING,
    icon: <IconTerminal legacySize="16px" variant="secondary" />,
    title: t('Logging'),
    description: t('See logs in context with errors and performance issues'),
  },
  {
    id: OnboardingWelcomeProductId.SESSION_REPLAY,
    icon: <IconTimer legacySize="16px" variant="secondary" />,
    title: t('Session replay'),
    description: t('Watch real user sessions to see what went wrong'),
  },
  {
    id: OnboardingWelcomeProductId.TRACING,
    icon: <IconSpan legacySize="16px" variant="secondary" />,
    title: t('Tracing'),
    description: t(
      'Find bottlenecks, broken requests, and understand application flow end-to-end.'
    ),
  },
  {
    id: OnboardingWelcomeProductId.METRICS,
    icon: <IconGraph legacySize="16px" variant="secondary" />,
    title: t('Metrics'),
    description: t(
      'Track application performance and usage over time with custom metrics.'
    ),
  },
  {
    id: OnboardingWelcomeProductId.PROFILING,
    icon: <IconProfiling legacySize="16px" variant="secondary" />,
    title: t('Profiling'),
    description: t(
      'Pinpoint the functions and lines of code responsible for performance issues.'
    ),
  },
  {
    id: OnboardingWelcomeProductId.AGENT_MONITORING,
    icon: <IconBot legacySize="16px" variant="secondary" />,
    title: t('Agent monitoring'),
    description: t(
      'Track all agent runs, error rates, LLM calls, tokens used, and tool executions.'
    ),
  },
  {
    id: OnboardingWelcomeProductId.SEER,
    icon: <IconSeer legacySize="16px" variant="secondary" />,
    title: t('Seer: AI Debugging Agent'),
    description: t(
      'Catch breaking changes, automatically root cause issues in production, and fix what you missed.'
    ),
    footer: <NewWelcomeSeerFlag />,
    badge: <FeatureBadge type="new" tooltipProps={{disabled: true}} />,
    extra: <NewWelcomeSeerExtra />,
  },
];

export function NewWelcomeUI(props: StepProps) {
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
        <Flex direction="column" gap="2xl">
          <MotionStack gap="md" {...ONBOARDING_WELCOME_STAGGER_ITEM}>
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

            <Stack gap="2xs">
              <Flex align="center" gap="md">
                <Container>
                  <IconBusiness legacySize="16px" variant="accent" />
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
          </MotionStack>

          <MotionGrid
            columns={{xs: '1fr', md: 'repeat(3, 1fr)'}}
            gap="lg"
            variants={STAGGER_CHILDREN}
          >
            {PRODUCT_OPTIONS.map(product => (
              <NewWelcomeProductCard key={product.id} product={product} />
            ))}
          </MotionGrid>

          <MotionContainer {...ONBOARDING_WELCOME_STAGGER_ITEM}>
            <Text size="md" variant="muted">
              {t(
                "After the trial ends, you'll move to our free plan. You will not be charged for any usage, promise."
              )}
            </Text>
          </MotionContainer>
        </Flex>
        <GenericFooter>
          <Flex align="center" padding="0 3xl">
            <WelcomeSkipButton asButton>{t('Skip onboarding')}</WelcomeSkipButton>
          </Flex>
          <Flex align="center" padding="0 3xl">
            <Button
              priority="primary"
              onClick={handleComplete}
              data-test-id="onboarding-welcome-start"
            >
              {t('Begin setup')}
            </Button>
          </Flex>
        </GenericFooter>
      </MotionFlex>
    </MotionContainer>
  );
}
