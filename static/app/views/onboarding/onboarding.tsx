import {useCallback, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {AnimatePresence, motion, useAnimation} from 'framer-motion';

import {Button} from 'sentry/components/core/button';
import Hook from 'sentry/components/hook';
import Link from 'sentry/components/links/link';
import LogoSentry from 'sentry/components/logoSentry';
import {useOnboardingContext} from 'sentry/components/onboarding/onboardingContext';
import {useRecentCreatedProject} from 'sentry/components/onboarding/useRecentCreatedProject';
import Redirect from 'sentry/components/redirect';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import categoryList from 'sentry/data/platformPickerCategories';
import platforms from 'sentry/data/platforms';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {OnboardingSelectedSDK} from 'sentry/types/onboarding';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import testableTransition from 'sentry/utils/testableTransition';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import PageCorners from 'sentry/views/onboarding/components/pageCorners';
import {useBackActions} from 'sentry/views/onboarding/useBackActions';
import {useOnboardingSidebar} from 'sentry/views/onboarding/useOnboardingSidebar';

import Stepper from './components/stepper';
import {PlatformSelection} from './platformSelection';
import SetupDocs from './setupDocs';
import type {StepDescriptor} from './types';
import TargetedOnboardingWelcome from './welcome';

type RouteParams = {
  step: string;
};

type Props = RouteComponentProps<RouteParams>;

export const onboardingSteps: StepDescriptor[] = [
  {
    id: 'welcome',
    title: t('Welcome'),
    Component: TargetedOnboardingWelcome,
    cornerVariant: 'top-right',
  },
  {
    id: 'select-platform',
    title: t('Select platform'),
    Component: PlatformSelection,
    hasFooter: true,
    cornerVariant: 'top-left',
  },
  {
    id: 'setup-docs',
    title: t('Install the Sentry SDK'),
    Component: SetupDocs,
    hasFooter: true,
    cornerVariant: 'top-left',
  },
];

function Onboarding(props: Props) {
  const organization = useOrganization();
  const onboardingContext = useOnboardingContext();
  const selectedProjectSlug = onboardingContext.selectedPlatform?.key;

  const {
    params: {step: stepId},
  } = props;

  const stepObj = onboardingSteps.find(({id}) => stepId === id);
  const stepIndex = onboardingSteps.findIndex(({id}) => stepId === id);

  const projectSlug =
    stepObj && stepObj.id === 'setup-docs' ? selectedProjectSlug : undefined;

  const {project: recentCreatedProject, isProjectActive} = useRecentCreatedProject({
    orgSlug: organization.slug,
    projectSlug,
    // Wait until the first event is received as we have an UI element that depends on it
    pollUntilFirstEvent: true,
  });

  const cornerVariantTimeoutRed = useRef<number | undefined>(undefined);

  const {activateSidebar} = useOnboardingSidebar();

  useEffect(() => {
    return () => {
      window.clearTimeout(cornerVariantTimeoutRed.current);
    };
  }, []);

  useEffect(() => {
    if (
      props.location.pathname === `/onboarding/${onboardingSteps[2]!.id}/` &&
      props.location.query?.platform &&
      onboardingContext.selectedPlatform === undefined
    ) {
      const platformKey = Object.keys(platforms).find(
        // @ts-expect-error TS(7015): Element implicitly has an 'any' type because index... Remove this comment to see the full error message
        key => platforms[key].id === props.location.query.platform
      );

      // @ts-expect-error TS(7015): Element implicitly has an 'any' type because index... Remove this comment to see the full error message
      const platform = platformKey ? platforms[platformKey] : undefined;

      // if no platform found, we redirect the user to the platform select page
      if (!platform) {
        props.router.push(
          normalizeUrl(`/onboarding/${organization.slug}/${onboardingSteps[1]!.id}/`)
        );
        return;
      }

      const frameworkCategory =
        categoryList.find(category => {
          return category.platforms?.has(platform.id);
        })?.id ?? 'all';

      onboardingContext.setSelectedPlatform({
        key: props.location.query.platform,
        category: frameworkCategory,
        language: platform.language,
        type: platform.type,
        link: platform.link,
        name: platform.name,
      });
    }
  }, [
    props.location.query,
    props.router,
    onboardingContext,
    organization.slug,
    props.location.pathname,
  ]);

  const shallProjectBeDeleted =
    stepObj?.id === 'setup-docs' && defined(isProjectActive) && !isProjectActive;

  const cornerVariantControl = useAnimation();
  const updateCornerVariant = () => {
    // TODO: find better way to delay the corner animation
    window.clearTimeout(cornerVariantTimeoutRed.current);

    cornerVariantTimeoutRed.current = window.setTimeout(
      () => cornerVariantControl.start(stepIndex === 0 ? 'top-right' : 'top-left'),
      1000
    );
  };

  useEffect(updateCornerVariant, [stepIndex, cornerVariantControl]);

  // Called onExitComplete
  const [containerHasFooter, setContainerHasFooter] = useState<boolean>(false);
  const updateAnimationState = () => {
    if (!stepObj) {
      return;
    }

    setContainerHasFooter(stepObj.hasFooter ?? false);
  };

  const goToStep = useCallback(
    (step: StepDescriptor) => {
      if (!stepObj) {
        return;
      }
      if (step.cornerVariant !== stepObj.cornerVariant) {
        cornerVariantControl.start('none');
      }
      props.router.push(normalizeUrl(`/onboarding/${organization.slug}/${step.id}/`));
    },
    [cornerVariantControl, organization.slug, props.router, stepObj]
  );

  const {handleGoBack} = useBackActions({
    stepIndex,
    goToStep,
    recentCreatedProject,
    isRecentCreatedProjectActive: isProjectActive,
    cornerVariantControl,
  });

  const goNextStep = useCallback(
    (step: StepDescriptor, platform?: OnboardingSelectedSDK) => {
      const currentStepIndex = onboardingSteps.findIndex(s => s.id === step.id);
      const nextStep = onboardingSteps[currentStepIndex + 1]!;

      if (nextStep.id === 'setup-docs' && !platform) {
        return;
      }

      if (step.cornerVariant !== nextStep.cornerVariant) {
        cornerVariantControl.start('none');
      }

      props.router.push(normalizeUrl(`/onboarding/${organization.slug}/${nextStep.id}/`));
    },
    [organization.slug, cornerVariantControl, props.router]
  );

  const genSkipOnboardingLink = () => {
    const source = `targeted-onboarding-${stepId}`;
    return (
      <SkipOnboardingLink
        onClick={() => {
          trackAnalytics('growth.onboarding_clicked_skip', {
            organization,
            source,
          });
          onboardingContext.setSelectedPlatform(undefined);
          activateSidebar({
            userClicked: false,
            source: `targeted_onboarding_select_platform_skip`,
          });
        }}
        to={normalizeUrl(
          `/organizations/${organization.slug}/issues/?referrer=onboarding-skip`
        )}
      >
        {t('Skip Onboarding')}
      </SkipOnboardingLink>
    );
  };

  // Redirect to the first step if we end up in an invalid state
  const isInvalidDocsStep = stepId === 'setup-docs' && !projectSlug;
  if (!stepObj || stepIndex === -1 || isInvalidDocsStep) {
    return (
      <Redirect
        to={normalizeUrl(`/onboarding/${organization.slug}/${onboardingSteps[0]!.id}/`)}
      />
    );
  }

  return (
    <OnboardingWrapper data-test-id="targeted-onboarding">
      <SentryDocumentTitle title={stepObj.title} />
      <Header>
        <LogoSvg />
        {stepIndex !== -1 && (
          <StyledStepper
            numSteps={onboardingSteps.length}
            currentStepIndex={stepIndex}
            onClick={i => {
              if ((i as number) < stepIndex && shallProjectBeDeleted) {
                // @ts-expect-error TS(2345): Argument of type 'number | MouseEvent<HTMLDivEleme... Remove this comment to see the full error message
                handleGoBack(i);
                return;
              }

              // @ts-expect-error TS(2538): Type 'MouseEvent<HTMLDivElement, MouseEvent>' cann... Remove this comment to see the full error message
              goToStep(onboardingSteps[i]);
            }}
          />
        )}
        <UpsellWrapper>
          <Hook
            name="onboarding:targeted-onboarding-header"
            source="targeted-onboarding"
          />
        </UpsellWrapper>
      </Header>
      <Container hasFooter={containerHasFooter}>
        <BackMotionDiv
          animate={stepIndex > 0 ? 'visible' : 'hidden'}
          transition={testableTransition()}
          variants={{
            initial: {opacity: 0, visibility: 'hidden'},
            visible: {
              opacity: 1,
              visibility: 'visible',
              transition: testableTransition({delay: 1}),
            },
            hidden: {
              opacity: 0,
              transitionEnd: {
                visibility: 'hidden',
              },
            },
          }}
        >
          <Button
            onClick={() => handleGoBack()}
            icon={<IconArrow direction="left" />}
            priority="link"
          >
            {t('Back')}
          </Button>
        </BackMotionDiv>
        <AnimatePresence mode="wait" onExitComplete={updateAnimationState}>
          <OnboardingStep
            initial="initial"
            animate="animate"
            exit="exit"
            variants={{animate: {}}}
            transition={testableTransition({
              staggerChildren: 0.2,
            })}
            key={stepObj.id}
            data-test-id={`onboarding-step-${stepObj.id}`}
          >
            {stepObj.Component && (
              <stepObj.Component
                active
                data-test-id={`onboarding-step-${stepObj.id}`}
                stepIndex={stepIndex}
                onComplete={platform => {
                  if (stepObj) {
                    goNextStep(stepObj, platform);
                  }
                }}
                orgId={organization.slug}
                search={props.location.search}
                route={props.route}
                router={props.router}
                location={props.location}
                recentCreatedProject={recentCreatedProject}
                {...{
                  genSkipOnboardingLink,
                }}
              />
            )}
          </OnboardingStep>
        </AnimatePresence>
        <AdaptivePageCorners animateVariant={cornerVariantControl} />
      </Container>
    </OnboardingWrapper>
  );
}

const Container = styled('div')<{hasFooter: boolean}>`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  background: ${p => p.theme.background};
  padding: 120px ${space(3)};
  width: 100%;
  margin: 0 auto;
  padding-bottom: ${p => p.hasFooter && '72px'};
  margin-bottom: ${p => p.hasFooter && '72px'};
`;

const Header = styled('header')`
  background: ${p => p.theme.background};
  padding-left: ${space(4)};
  padding-right: ${space(4)};
  position: sticky;
  height: 80px;
  align-items: center;
  top: 0;
  z-index: 100;
  box-shadow: 0 5px 10px rgba(0, 0, 0, 0.05);
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  justify-items: stretch;
`;

const LogoSvg = styled(LogoSentry)`
  width: 130px;
  height: 30px;
  color: ${p => p.theme.textColor};
`;

const OnboardingStep = styled(motion.div)`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
`;

const AdaptivePageCorners = styled(PageCorners)`
  --corner-scale: 1;
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    --corner-scale: 0.5;
  }
`;

const StyledStepper = styled(Stepper)`
  justify-self: center;
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    display: none;
  }
`;

const BackMotionDiv = styled(motion.div)<React.HTMLAttributes<HTMLDivElement>>`
  position: absolute;
  top: 40px;
  left: 20px;

  button {
    font-size: ${p => p.theme.fontSizeSmall};
  }
`;

const SkipOnboardingLink = styled(Link)`
  margin: auto ${space(4)};
`;

const UpsellWrapper = styled('div')`
  grid-column: 3;
  margin-left: auto;
`;

const OnboardingWrapper = styled('main')`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
`;

export default Onboarding;
