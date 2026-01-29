import {useCallback, useEffect} from 'react';
import styled from '@emotion/styled';
import type {MotionProps} from 'framer-motion';
import {motion} from 'framer-motion';

import SeerIllustration from 'sentry-images/spot/seer-onboarding.png';

import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {Button} from 'sentry/components/core/button';
import {ExternalLink} from 'sentry/components/core/link';
import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {
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
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import testableTransition from 'sentry/utils/testableTransition';
import useOrganization from 'sentry/utils/useOrganization';
import GenericFooter from 'sentry/views/onboarding/components/genericFooter';
import {WelcomeBackgroundNewUi} from 'sentry/views/onboarding/components/welcomeBackground';
import type {StepProps} from 'sentry/views/onboarding/types';

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
};

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
];

type ProductCardProps = {
  description: string;
  icon: React.ReactNode;
  title: string;
};

function ProductCard({icon, title, description}: ProductCardProps) {
  return (
    <Container border="muted" radius="lg" padding="xl">
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
        <Container area="cell2">
          <Text bold size="lg" density="comfortable">
            {title}
          </Text>
        </Container>
        <Container area="cell4">
          <Text variant="muted" size="md" density="comfortable">
            {description}
          </Text>
        </Container>
      </Grid>
    </Container>
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
    <NewWelcomeWrapper>
      <WelcomeBackgroundNewUi />
      <ContentWrapper {...fadeAway}>
        <Stack gap="2xl">
          <Flex direction="column" gap="lg" paddingBottom="2xl">
            <Heading as="h1">{t('Welcome to Sentry')}</Heading>
            <Text variant="muted" size="lg" bold wrap="pre-line" density="comfortable">
              {t(
                "Your code is probably broken, and we'll help you fix it faster.\nWe're not just error monitoring anymore y'know."
              )}
            </Text>
          </Flex>

          <Flex align="center" gap="md">
            <IconBusiness size="sm" variant="accent" />
            <Text size="lg" bold variant="muted" density="comfortable">
              {t('Your 14-day business trial includes')}{' '}
              <ExternalLink href="https://docs.sentry.io/product/accounts/pricing/">
                {t('unlimited access')}
              </ExternalLink>{' '}
              {t('to:')}
            </Text>
          </Flex>
        </Stack>

        <Grid columns={{xs: '1fr', sm: 'repeat(2, 1fr)', md: 'repeat(3, 1fr)'}} gap="lg">
          {PRODUCT_OPTIONS.map(product => (
            <ProductCard
              key={product.id}
              icon={product.icon}
              title={product.title}
              description={product.description}
            />
          ))}
        </Grid>

        <Flex justify="center">
          <Text size="xl" variant="secondary" bold>
            +
          </Text>
        </Flex>

        <Container border="muted" radius="lg" padding="xl" overflow="hidden">
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

            <SeerIllustrationWrapper>
              <img src={SeerIllustration} alt="" />
            </SeerIllustrationWrapper>
          </Flex>
        </Container>

        <Text variant="muted" bold>
          {t(
            "After the trial ends, you'll move to our free plan. You will not be charged for any usage, promise."
          )}
        </Text>
      </ContentWrapper>
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
    </NewWelcomeWrapper>
  );
}

const NewWelcomeWrapper = styled(motion.div)`
  position: relative;
  display: flex;
  align-items: center;
  flex-direction: column;
  max-width: 900px;
  width: 100%;
  margin-left: auto;
  margin-right: auto;
  padding: ${space(2)};
  gap: ${space(4)};
`;

const ContentWrapper = styled(motion.div)`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const SeerIllustrationWrapper = styled('div')`
  flex-shrink: 0;
  margin-top: -20px;
  margin-bottom: -40px;
  margin-right: -10px;

  img {
    display: block;
    max-height: 120px;
    width: auto;
  }

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    display: none;
  }
`;
