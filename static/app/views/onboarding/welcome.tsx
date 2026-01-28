import {Fragment, useCallback, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import type {MotionProps} from 'framer-motion';
import {motion} from 'framer-motion';

import OnboardingInstall from 'sentry-images/spot/onboarding-install.svg';

import {Button} from '@sentry/scraps/button';
import {Container, Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {DO_NOT_USE_getButtonStyles as getButtonStyles} from 'sentry/components/core/button/styles';
import {Checkbox} from 'sentry/components/core/checkbox';
import {ExternalLink} from 'sentry/components/core/link';
import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {
  IconGraph,
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
import FallingError from 'sentry/views/onboarding/components/fallingError';
import GenericFooter from 'sentry/views/onboarding/components/genericFooter';
import WelcomeBackground, {
  WelcomeBackgroundNewUi,
} from 'sentry/views/onboarding/components/welcomeBackground';
import {useOnboardingSidebar} from 'sentry/views/onboarding/useOnboardingSidebar';

import type {StepProps} from './types';

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

const PRODUCT_OPTIONS: ProductOption[] = [
  {
    id: 'error-monitoring',
    icon: <IconWarning size="sm" />,
    title: t('Error monitoring'),
    description: t('Automatically capture exceptions and stack traces'),
  },
  {
    id: 'logging',
    icon: <IconTerminal size="sm" />,
    title: t('Logging'),
    description: t('See logs in context with errors and performance issues'),
  },
  {
    id: 'metrics',
    icon: <IconGraph size="sm" />,
    title: t('Metrics'),
    description: t('Custom metrics for tracking application performance and usage'),
  },
  {
    id: 'session-replay',
    icon: <IconTimer size="sm" />,
    title: t('Session replay'),
    description: t('Watch real user sessions to see what went wrong'),
  },
  {
    id: 'tracing',
    icon: <IconSpan size="sm" />,
    title: t('Tracing'),
    description: t('Find slow transactions, bottlenecks, and timeouts'),
  },
  {
    id: 'profiling',
    icon: <IconProfiling size="sm" />,
    title: t('Profiling'),
    description: t('See the exact lines of code causing your performance bottlenecks.'),
  },
];

type ProductCardProps = {
  checked: boolean;
  description: string;
  icon: React.ReactNode;
  onToggle: () => void;
  title: string;
};

function ProductCard({
  icon,
  title,
  description,
  checked,
  id,
  onToggle,
}: ProductCardProps) {
  return (
    <ProductCardContainer
      checked={checked}
      onClick={onToggle}
      role="checkbox"
      aria-checked={checked}
      disabled={id === 'error-monitoring'}
      tabIndex={0}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onToggle();
        }
      }}
    >
      <span>
        <Flex justify="between" align="center">
          <ProductIcon checked={checked}>{icon}</ProductIcon>
          <Checkbox checked={checked} readOnly size="sm" tabIndex={-1} />
        </Flex>
        <Flex direction="column" gap="xs">
          <ProductTitle>{title}</ProductTitle>
          <ProductDescription checked={checked} size="sm">
            {description}
          </ProductDescription>
        </Flex>
      </span>
    </ProductCardContainer>
  );
}

function NewWelcomeUI(props: StepProps) {
  const organization = useOrganization();
  const onboardingContext = useOnboardingContext();
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(
    () => new Set(['error-monitoring'])
  );

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

  const handleToggleProduct = useCallback((productId: string) => {
    setSelectedProducts(prev => {
      const next = new Set(prev);
      if (next.has(productId)) {
        next.delete(productId);
      } else {
        next.add(productId);
      }
      return next;
    });
  }, []);

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
        <Flex direction="column" gap="sm">
          <NewWelcomeTitle>{t('Welcome to Sentry')}</NewWelcomeTitle>
          <Text variant="muted">
            {t(
              "Your code is probably broken. Maybe not. Tell us what you care about and we'll get you set up, fast."
            )}
          </Text>
        </Flex>

        <MainContentGrid>
          <ProductSelectionSection>
            <Flex direction="column" gap="xs">
              <SectionTitle>{t('What do you want to set up?')}</SectionTitle>
              <Text variant="muted" size="sm">
                {t(
                  "Select all that apply and we'll tailor the setup steps. You can change this at anytime."
                )}
              </Text>
            </Flex>

            <ProductGrid>
              {PRODUCT_OPTIONS.map(product => (
                <ProductCard
                  key={product.id}
                  id={product.id}
                  icon={product.icon}
                  title={product.title}
                  description={product.description}
                  checked={selectedProducts.has(product.id)}
                  onToggle={() => handleToggleProduct(product.id)}
                />
              ))}
            </ProductGrid>
          </ProductSelectionSection>

          <SeerSection>
            <Text variant="muted" size="sm">
              {t('Your 14-day business trial also includes')}{' '}
              <ExternalLink href="https://docs.sentry.io/product/accounts/pricing/">
                {t('unlimited access')}
              </ExternalLink>{' '}
              {t('to:')}
            </Text>
            <SeerCard border="primary" radius="md" padding="md">
              <Flex gap="xs" align="center">
                <FeatureBadge type="new" tooltipProps={{disabled: true}} />
                <IconSeer size="sm" />
              </Flex>
              <Flex direction="column" gap="xs">
                <ProductTitle>{t('Seer: AI Debugging Agent')}</ProductTitle>
                <Text variant="muted" size="sm">
                  {t('Analyze issues, review PRs, and propose code fixes.')}
                </Text>
              </Flex>
              <Text variant="muted" size="xs">
                {t('*Requires connection to GitHub')}
              </Text>
            </SeerCard>
          </SeerSection>
        </MainContentGrid>
      </ContentWrapper>
      <GenericFooter>
        {props.genSkipOnboardingLink()}
        <NextButtonWrapper>
          <Button priority="primary" onClick={handleComplete}>
            {t('Next')}
          </Button>
        </NextButtonWrapper>
      </GenericFooter>
    </NewWelcomeWrapper>
  );
}

type TextWrapperProps = {
  cta: React.ReactNode;
  src: string;
  subText: React.ReactNode;
  title: React.ReactNode;
};

function InnerAction({title, subText, cta, src}: TextWrapperProps) {
  return (
    <Fragment>
      <ActionImage src={src} />
      <TextWrapper>
        <ActionTitle>{title}</ActionTitle>
        <Text variant="muted">{subText}</Text>
      </TextWrapper>
      <ButtonWrapper>{cta}</ButtonWrapper>
    </Fragment>
  );
}

function LegacyWelcomeUI(props: StepProps) {
  const organization = useOrganization();
  const onboardingContext = useOnboardingContext();
  const {activateSidebar} = useOnboardingSidebar();

  const source = 'targeted_onboarding';

  useEffect(() => {
    trackAnalytics('growth.onboarding_start_onboarding', {
      organization,
      source,
    });

    if (onboardingContext.selectedPlatform) {
      // At this point the selectedSDK shall be undefined but just in case, cleaning this up here too
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

  const handleSkipOnboarding = useCallback(() => {
    trackAnalytics('growth.onboarding_clicked_skip', {
      organization,
      source,
    });

    activateSidebar({userClicked: false, source: 'targeted_onboarding_welcome_skip'});
  }, [organization, source, activateSidebar]);

  return (
    <FallingError>
      {({fallingError, fallCount, isFalling}) => (
        <Wrapper>
          <WelcomeBackground />
          <motion.h1 {...fadeAway} style={{marginBottom: space(0.5)}}>
            {t('Welcome to Sentry')}
          </motion.h1>
          <SubHeaderText style={{marginBottom: space(4)}} {...fadeAway}>
            {t(
              'Your code is probably broken. Maybe not. Find out for sure. Get started below.'
            )}
          </SubHeaderText>
          <ActionItem {...fadeAway}>
            <InnerAction
              title={t('Install Sentry')}
              subText={t(
                'Select your languages or frameworks and install the SDKs to start tracking issues'
              )}
              src={OnboardingInstall}
              cta={
                <Fragment>
                  <ButtonWithFill onClick={handleComplete} priority="primary">
                    {t('Start')}
                  </ButtonWithFill>
                  {(fallCount === 0 || isFalling) && (
                    <PositionedFallingError>{fallingError}</PositionedFallingError>
                  )}
                </Fragment>
              }
            />
          </ActionItem>
          <motion.p style={{margin: 0}} {...fadeAway}>
            {t("Gee, I've used Sentry before.")}
            <br />
            <Link
              onClick={handleSkipOnboarding}
              to={`/organizations/${organization.slug}/issues/?referrer=onboarding-welcome-skip`}
            >
              {t('Skip onboarding.')}
            </Link>
          </motion.p>
        </Wrapper>
      )}
    </FallingError>
  );
}

function TargetedOnboardingWelcome(props: StepProps) {
  const organization = useOrganization();
  const hasNewWelcomeUI = organization.features.includes('onboarding-new-welcome-ui');

  if (hasNewWelcomeUI) {
    return <NewWelcomeUI {...props} />;
  }

  return <LegacyWelcomeUI {...props} />;
}

export default TargetedOnboardingWelcome;

const PositionedFallingError = styled('span')`
  display: block;
  position: absolute;
  right: 0px;
  top: 30px;
`;

const Wrapper = styled(motion.div)`
  position: relative;
  margin-top: auto;
  margin-bottom: auto;
  max-width: 400px;
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  margin-left: auto;
  margin-right: auto;

  h1 {
    font-size: 42px;
  }
`;

const ActionItem = styled(motion.div)`
  min-height: 120px;
  border-radius: ${space(0.5)};
  padding: ${space(2)};
  margin-bottom: ${space(2)};
  justify-content: space-around;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    display: grid;
    grid-template-columns: 125px auto 125px;
    width: 680px;
    align-items: center;
  }
  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    display: flex;
    flex-direction: column;
  }
`;

const TextWrapper = styled('div')`
  text-align: left;
  margin: auto ${space(3)};
  min-height: 70px;
  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    text-align: center;
    margin: ${space(1)} ${space(1)};
    margin-top: ${space(3)};
  }
`;

const ActionTitle = styled('h5')`
  font-weight: ${p => p.theme.font.weight.sans.medium};
  margin: 0 0 ${space(0.5)};
  color: ${p => p.theme.tokens.content.primary};
`;

const SubHeaderText = styled(motion.h6)`
  color: ${p => p.theme.tokens.content.secondary};
`;

const ButtonWrapper = styled('div')`
  margin: ${space(1)};
  position: relative;
`;

const ActionImage = styled('img')`
  height: 100px;
`;

const ButtonWithFill = styled(Button)`
  width: 100%;
  position: relative;
  z-index: 1;
`;

// New Welcome UI Styles
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
  gap: ${space(4)};
`;

const NewWelcomeTitle = styled('h1')`
  font-size: 32px;
  margin: 0;
`;

const SectionTitle = styled('h2')`
  font-size: ${p => p.theme.font.size.lg};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  margin: 0;
`;

const MainContentGrid = styled('div')`
  display: grid;
  grid-template-columns: 1fr auto;
  gap: ${space(4)};
  align-items: start;

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    grid-template-columns: 1fr;
  }
`;

const ProductSelectionSection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

const ProductGrid = styled('div')`
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: ${space(1.5)};

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: 1fr;
  }
`;

const ProductCardContainer = styled('div')<{checked: boolean}>`
  cursor: pointer;
  text-align: left;

  ${p => ({
    ...getButtonStyles({
      ...p,
      size: 'md',
      priority: p.checked ? 'primary' : 'default',
    }),
  })}

  /* Override button sizing to work as a card */
  height: auto;
  min-height: auto;
  padding: ${space(2)};

  /* Content layout */
  > span:last-child {
    display: flex;
    flex-direction: column;
    gap: ${space(1.5)};
    align-items: stretch;
    white-space: normal;
  }
`;

const ProductIcon = styled('div')<{checked: boolean}>`
  color: ${p =>
    p.checked
      ? p.theme.tokens.interactive.chonky.embossed.accent.content
      : p.theme.tokens.content.secondary};
`;

const ProductDescription = styled(Text)<{checked: boolean}>`
  color: ${p =>
    p.checked
      ? p.theme.tokens.interactive.chonky.embossed.accent.content
      : p.theme.tokens.content.secondary};
`;

const ProductTitle = styled('div')`
  font-weight: ${p => p.theme.font.weight.sans.medium};
`;

const SeerSection = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(1.5)};
  max-width: 280px;

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    max-width: 100%;
  }
`;

const SeerCard = styled(Container)`
  display: flex;
  flex-direction: column;
  gap: ${space(1.5)};
  background: ${p => p.theme.tokens.background.secondary};
`;

const NextButtonWrapper = styled('div')`
  display: flex;
  align-items: center;
  margin-left: auto;
  padding: 0 ${space(2)};
`;
