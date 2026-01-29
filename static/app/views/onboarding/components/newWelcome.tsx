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
    icon: <IconWarning size="sm" variant="secondary" />,
    title: t('Error monitoring'),
    description: t('Automatically capture exceptions and stack traces'),
  },
  {
    id: 'logging',
    icon: <IconTerminal size="sm" variant="secondary" />,
    title: t('Logging'),
    description: t('See logs in context with errors and performance issues'),
  },
  {
    id: 'session-replay',
    icon: <IconTimer size="sm" variant="secondary" />,
    title: t('Session replay'),
    description: t('Watch real user sessions to see what went wrong'),
  },
  {
    id: 'metrics',
    icon: <IconGraph size="sm" variant="secondary" />,
    title: t('Metrics'),
    description: t('Custom metrics for tracking application performance and usage'),
  },
  {
    id: 'tracing',
    icon: <IconSpan size="sm" variant="secondary" />,
    title: t('Tracing'),
    description: t('Find slow transactions, bottlenecks, and timeouts'),
  },
  {
    id: 'profiling',
    icon: <IconProfiling size="sm" variant="secondary" />,
    title: t('Profiling'),
    description: t('See the exact lines of code causing your performance bottlenecks.'),
  },
];

type ProductCardProps = {
  description: string;
  icon: React.ReactNode;
  title: string;
};

function ProductCard({icon, title, description}: ProductCardProps) {
  return (
    <ProductCardContainer border="muted" radius="lg" padding="xl">
      <Flex align="center">{icon}</Flex>
      <Flex direction="column" gap="xs">
        <ProductTitle>{title}</ProductTitle>
        <Text variant="muted">{description}</Text>
      </Flex>
    </ProductCardContainer>
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
            <NewWelcomeTitle as="h1">{t('Welcome to Sentry')}</NewWelcomeTitle>
            <Text variant="muted" size="lg" bold wrap="pre-line">
              {t(
                "Your code is probably broken, and we'll help you fix it faster.\nWe're not just error monitoring anymore y'know."
              )}
            </Text>
          </Flex>

          <Flex align="center" gap="md">
            <IconBusiness size="sm" variant="accent" />
            <Text size="lg" bold variant="muted">
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

        <SeerCard border="muted" radius="lg" padding="xl">
          <SeerCardContent>
            <IconSeer size="sm" variant="secondary" />
            <Flex direction="column" gap="xs">
              <Flex gap="sm" align="center">
                <ProductTitle>{t('Seer: AI Debugging Agent')}</ProductTitle>
                <FeatureBadge type="new" tooltipProps={{disabled: true}} />
              </Flex>
              <Text variant="muted" wrap="pre-line">
                {t(
                  "Analyze issues, review PRs, and propose code fixes.\nBecause of course we have an AI tool, it's 2026."
                )}
              </Text>
              <Flex gap="xs" align="center">
                <IconInfo size="xs" />
                <Text variant="muted" size="xs">
                  {t('Requires additional setup')}
                </Text>
              </Flex>
            </Flex>
          </SeerCardContent>
          <SeerIllustrationWrapper>
            <img src={SeerIllustration} alt="" />
          </SeerIllustrationWrapper>
        </SeerCard>

        <Text variant="muted" bold>
          {t(
            "After the trial ends, you'll move to our free plan. You will not be charged for any usage, promise."
          )}
        </Text>
      </ContentWrapper>
      <GenericFooter>
        {props.genSkipOnboardingLink()}
        <NextButtonWrapper>
          <Button
            priority="primary"
            onClick={handleComplete}
            data-test-id="onboarding-welcome-start"
          >
            {t('Next')}
          </Button>
        </NextButtonWrapper>
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
  margin-top: auto;
  margin-bottom: auto;
  margin-left: auto;
  margin-right: auto;
  padding: ${space(2)};
  padding-bottom: 100px; /* Account for fixed footer (72px) + spacing */
  gap: ${space(4)};
`;

const ContentWrapper = styled(motion.div)`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const NewWelcomeTitle = styled(Heading)`
  font-size: 32px;
`;

const ProductCardContainer = styled(Container)`
  display: flex;
  flex-direction: column;
  gap: ${space(1.5)};
`;

const ProductTitle = styled('div')`
  font-weight: ${p => p.theme.font.weight.sans.medium};
`;

const SeerCard = styled(Container)`
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: ${space(2)};
  overflow: hidden;
`;

const SeerCardContent = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1.5)};
  flex: 1;
`;

const SeerIllustrationWrapper = styled('div')`
  flex-shrink: 0;

  img {
    display: block;
    max-height: 140px;
    width: auto;
  }

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    display: none;
  }
`;

const NextButtonWrapper = styled('div')`
  display: flex;
  align-items: center;
  margin-left: auto;
  padding: 0 ${space(2)};
`;
