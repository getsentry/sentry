import {useCallback, useEffect, type ReactNode} from 'react';
import styled from '@emotion/styled';
import type {MotionProps} from 'framer-motion';
import {motion} from 'framer-motion';

import SeerIllustration from 'sentry-images/spot/seer-onboarding.png';

import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {Button} from 'sentry/components/core/button';
import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {
  IconBot,
  IconBusiness,
  IconGraph,
  IconInfo,
  IconProfiling,
  IconSeer,
  IconSpan,
  IconTerminal,
  IconTimer,
  IconWarning,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import testableTransition from 'sentry/utils/testableTransition';
import useOrganization from 'sentry/utils/useOrganization';
import GenericFooter from 'sentry/views/onboarding/components/genericFooter';
import {WelcomeBackgroundNewUi} from 'sentry/views/onboarding/components/welcomeBackground';
import type {StepProps} from 'sentry/views/onboarding/types';

const MotionContainer = motion.create(Container);
const MotionFlex = motion.create(Flex);

const fadeAway: MotionProps = {
  variants: {
    initial: {opacity: 0},
    animate: {opacity: 1, filter: 'blur(0px)'},
    exit: {opacity: 0, filter: 'blur(1px)'},
  },
  transition: testableTransition({duration: 0.8}),
};

type ProductOption = {
  description: string;
  icon: React.ReactNode;
  id: string;
  title: string;
  badge?: React.ReactNode;
  extra?: React.ReactNode;
  footer?: React.ReactNode;
};

function SeerFlag() {
  return (
    <Flex gap="md" align="center">
      <IconInfo legacySize="16px" variant="secondary" />
      <Container>
        <Text variant="muted" size="sm" density="comfortable" bold>
          {t('Requires additional setup')}
        </Text>
      </Container>
    </Flex>
  );
}

// Product options in display order (3x2 grid: row1: Error, Logging, Session; row2: Metrics, Tracing, Profiling)
const PRODUCT_OPTIONS: ProductOption[] = [
  {
    id: 'error-monitoring',
    icon: <IconWarning legacySize="16px" variant="secondary" />,
    title: t('Error monitoring'),
    description: t('Automatically capture exceptions and stack traces'),
  },
  {
    id: 'logging',
    icon: <IconTerminal legacySize="16px" variant="secondary" />,
    title: t('Logging'),
    description: t('See logs in context with errors and performance issues'),
  },
  {
    id: 'session-replay',
    icon: <IconTimer legacySize="16px" variant="secondary" />,
    title: t('Session replay'),
    description: t('Watch real user sessions to see what went wrong'),
  },
  {
    id: 'tracing',
    icon: <IconSpan legacySize="16px" variant="secondary" />,
    title: t('Tracing'),
    description: t(
      'Find bottlenecks, broken requests, and understand application flow end-to-end.'
    ),
  },
  {
    id: 'metrics',
    icon: <IconGraph legacySize="16px" variant="secondary" />,
    title: t('Metrics'),
    description: t(
      'Track application performance and usage over time with custom metrics.'
    ),
  },
  {
    id: 'profiling',
    icon: <IconProfiling legacySize="16px" variant="secondary" />,
    title: t('Profiling'),
    description: t(
      'Pinpoint the functions and lines of code responsible for performance issues.'
    ),
  },
  {
    id: 'agent-monitoring',
    icon: <IconBot legacySize="16px" variant="secondary" />,
    title: t('Agent monitoring'),
    description: t(
      'Track all agent runs, error rates, LLM calls, tokens used, and tool executions.'
    ),
  },
  {
    id: 'seer',
    icon: <IconSeer legacySize="16px" variant="secondary" />,
    title: t('Seer: AI Debugging Agent'),
    description: t(
      'Catch breaking changes, automatically root cause issues in production, and fix what you missed.'
    ),
    footer: <SeerFlag />,
    badge: <FeatureBadge type="new" tooltipProps={{disabled: true}} />,
    extra: <SeerExtra />,
  },
];

function SeerExtra() {
  return (
    <SeerIllustrationWrapper>
      <img src={SeerIllustration} alt="" />
    </SeerIllustrationWrapper>
  );
}

interface ProductCardProps {
  description: string;
  icon: React.ReactNode;
  title: string;
  badge?: ReactNode;
  extra?: ReactNode;
  footer?: ReactNode;
  span?: number;
}

function ProductCard({
  icon,
  title,
  description,
  span,
  badge,
  footer,
  extra,
}: ProductCardProps) {
  return (
    <CardContainer
      border="muted"
      radius="lg"
      padding="xl"
      background={span ? 'secondary' : 'primary'}
      overflow={span ? 'hidden' : undefined}
      position={span ? 'relative' : undefined}
      $span={span}
    >
      <Grid
        columns="min-content 1fr"
        rows="min-content min-content"
        gap="xs lg"
        align="center"
        areas={`"cell1 cell2"
          ". cell4"`}
      >
        <Flex area="cell1" align="center">
          {icon}
        </Flex>
        <Flex area="cell2" gap="md">
          <Container>
            <Text bold size="lg" density="comfortable">
              {title}
            </Text>
          </Container>
          {badge}
        </Flex>
        <Stack area="cell4" gap="xl">
          <Container>
            <Text variant="muted" size="md" density="comfortable">
              {description}
            </Text>
          </Container>
          {footer}
        </Stack>
      </Grid>

      {extra}
    </CardContainer>
  );
}

export function NewWelcomeUI(props: StepProps) {
  const organization = useOrganization();
  const onboardingContext = useOnboardingContext();

  const source = 'targeted_onboarding';

  useEffect(() => {
    trackAnalytics('growth.onboarding_start_onboarding', {
      organization,
      source,
    });

    if (onboardingContext.selectedPlatform) {
      onboardingContext.setSelectedPlatform(undefined);
    }
  }, [organization, onboardingContext]);

  const handleComplete = useCallback(() => {
    trackAnalytics('growth.onboarding_clicked_instrument_app', {
      organization,
      source,
    });

    props.onComplete();
  }, [organization, source, props]);

  return (
    <MotionContainer width="100%" margin="0 auto" maxWidth="900px" position="relative">
      <Flex direction="column" align="center">
        <WelcomeBackgroundNewUi />
        <MotionFlex direction="column" gap="2xl" {...fadeAway}>
          <Stack gap="md">
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
                <IconBusiness legacySize="16px" variant="accent" />
                <Container>
                  <Text size="lg" bold density="comfortable">
                    {t(
                      'You’ve got 14 days of Business with unlimited access to everything below.'
                    )}
                  </Text>
                </Container>
              </Flex>
              <Container>
                <Text size="md" variant="muted">
                  We’ll walk you through setup next. Start with what matters now, add the
                  rest when you’re ready.
                </Text>
              </Container>
            </Stack>
          </Stack>

          <Grid columns={{xs: '1fr', md: 'repeat(3, 1fr)'}} gap="lg" flex={0.75}>
            {PRODUCT_OPTIONS.map((product, index) => (
              <ProductCard
                key={product.id}
                icon={product.icon}
                title={product.title}
                description={product.description}
                span={index === PRODUCT_OPTIONS.length - 1 ? 2 : undefined}
                badge={product.badge}
                footer={product.footer}
                extra={product.extra}
              />
            ))}
          </Grid>

          {/* <Container border="muted" radius="lg" padding="xl" overflow="hidden">
          <Flex>
            <Flex flex="1">
              <Grid
                columns="min-content 1fr"
                rows="min-content min-content"
                gap="xs lg"
                align="center"
                areas={`"cell1 cell2"
                ". cell4"`}
              >
                <Flex area="cell1" align="center">
                  <IconSeer legacySize="16px" variant="secondary" />
                </Flex>

                <Flex gap="sm" align="center" area="cell2">
                  <Text bold size="lg" density="comfortable">
                    {t('Seer: AI Debugging Agent')}
                  </Text>
                  <FeatureBadge type="new" tooltipProps={{disabled: true}} />
                </Flex>

                <Stack gap="xl" area="cell4">
                  <Text variant="muted" wrap="pre-line" density="comfortable">
                    {t('Analyze issues, review PRs, and propose code fixes.')}
                  </Text>

                  <Flex gap="xs" align="center">
                    <IconInfo size="xs" />
                    <Text variant="muted" size="xs" density="comfortable">
                      {t('Requires additional setup')}
                    </Text>
                  </Flex>
                </Stack>
              </Grid>
            </Flex>


          </Flex>
        </Container> */}

          <Container>
            <Text size="md" variant="muted">
              {t(
                "After the trial ends, you'll move to our free plan. You will not be charged for any usage, promise."
              )}
            </Text>
          </Container>
        </MotionFlex>
        <GenericFooter>
          {props.genSkipOnboardingLink()}
          <Flex align="center" padding="0 lg">
            <Button
              priority="primary"
              onClick={handleComplete}
              data-test-id="onboarding-welcome-start"
            >
              {t('Next')}
            </Button>
          </Flex>
        </GenericFooter>
      </Flex>
    </MotionContainer>
  );
}

const SeerIllustrationWrapper = styled(Flex)`
  position: absolute;
  right: 0;
  top: ${p => p.theme.space.xl};
  bottom: ${p => p.theme.space.xl};
  transform: translateX(45%);

  img {
    object-fit: cover;
    object-position: left;
  }

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    display: none;
  }
`;

const CardContainer = styled(Container)<{$span?: number}>`
  ${p =>
    p.$span &&
    `
    @media (min-width: ${p.theme.breakpoints.md}) {
      padding-right: 36%;
      grid-column: span ${p.$span};
    }
  `}
`;
