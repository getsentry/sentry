import {useCallback, useContext, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import type {MotionProps} from 'framer-motion';
import {AnimatePresence, motion, useAnimation} from 'framer-motion';

import {removeProject} from 'sentry/actionCreators/projects';
import type {ButtonProps} from 'sentry/components/button';
import {Button} from 'sentry/components/button';
import type {OpenConfirmOptions} from 'sentry/components/confirm';
import Confirm, {openConfirmModal} from 'sentry/components/confirm';
import Hook from 'sentry/components/hook';
import Link from 'sentry/components/links/link';
import LogoSentry from 'sentry/components/logoSentry';
import {OnboardingContext} from 'sentry/components/onboarding/onboardingContext';
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
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import testableTransition from 'sentry/utils/testableTransition';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import PageCorners from 'sentry/views/onboarding/components/pageCorners';

import Stepper from './components/stepper';
import {PlatformSelection} from './platformSelection';
import SetupDocs from './setupDocs';
import type {StepDescriptor} from './types';
import TargetedOnboardingWelcome from './welcome';

type RouteParams = {
  step: string;
};

type Props = RouteComponentProps<RouteParams, {}>;

function getOrganizationOnboardingSteps(): StepDescriptor[] {
  return [
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
}

function Onboarding(props: Props) {
  const api = useApi();
  const organization = useOrganization();
  const onboardingContext = useContext(OnboardingContext);
  const selectedSDK = onboardingContext.data.selectedSDK;
  const selectedProjectSlug = selectedSDK?.key;

  const {
    params: {step: stepId},
  } = props;

  const onboardingSteps = getOrganizationOnboardingSteps();
  const stepObj = onboardingSteps.find(({id}) => stepId === id);
  const stepIndex = onboardingSteps.findIndex(({id}) => stepId === id);
  const projectSlug =
    stepObj && stepObj.id === 'setup-docs' ? selectedProjectSlug : undefined;

  const recentCreatedProject = useRecentCreatedProject({
    orgSlug: organization.slug,
    projectSlug,
  });

  const cornerVariantTimeoutRed = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      window.clearTimeout(cornerVariantTimeoutRed.current);
    };
  }, []);

  useEffect(() => {
    if (
      props.location.pathname === `/onboarding/${onboardingSteps[2]!.id}/` &&
      props.location.query?.platform &&
      onboardingContext.data.selectedSDK === undefined
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

      onboardingContext.setData({
        ...onboardingContext.data,
        selectedSDK: {
          key: props.location.query.platform,
          category: frameworkCategory,
          language: platform.language,
          type: platform.type,
          link: platform.link,
          name: platform.name,
        },
      });
    }
  }, [
    props.location.query,
    props.router,
    onboardingContext,
    onboardingSteps,
    organization.slug,
    props.location.pathname,
  ]);

  const shallProjectBeDeleted =
    stepObj?.id === 'setup-docs' &&
    recentCreatedProject &&
    // if the project has received a first error, we don't delete it
    recentCreatedProject.firstError === false &&
    // if the project has received a first transaction, we don't delete it
    recentCreatedProject.firstTransaction === false &&
    // if the project has replays, we don't delete it
    recentCreatedProject.hasReplays === false &&
    // if the project has sessions, we don't delete it
    recentCreatedProject.hasSessions === false &&
    // if the project is older than one hour, we don't delete it
    recentCreatedProject.olderThanOneHour === false;

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

  const goToStep = (step: StepDescriptor) => {
    if (!stepObj) {
      return;
    }
    if (step.cornerVariant !== stepObj.cornerVariant) {
      cornerVariantControl.start('none');
    }
    props.router.push(normalizeUrl(`/onboarding/${organization.slug}/${step.id}/`));
  };

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
    [organization.slug, onboardingSteps, cornerVariantControl, props.router]
  );

  const deleteRecentCreatedProject = useCallback(async () => {
    if (!recentCreatedProject?.slug) {
      return;
    }

    const newProjects = Object.keys(onboardingContext.data.projects).reduce(
      (acc, key) => {
        if (
          onboardingContext.data.projects[key]!.slug !==
          onboardingContext.data.selectedSDK?.key
        ) {
          // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          acc[key] = onboardingContext.data.projects[key];
        }
        return acc;
      },
      {}
    );

    try {
      await removeProject({
        api,
        orgSlug: organization.slug,
        projectSlug: recentCreatedProject.slug,
        origin: 'onboarding',
      });
      onboardingContext.setData({
        ...onboardingContext.data,
        projects: newProjects,
      });

      trackAnalytics('onboarding.data_removed', {
        organization,
        date_created: recentCreatedProject.dateCreated,
        platform: recentCreatedProject.slug,
        project_id: recentCreatedProject.id,
      });
    } catch (error) {
      handleXhrErrorResponse('Unable to delete project in onboarding', error);
      // we don't give the user any feedback regarding this error as this shall be silent
    }
  }, [api, organization, recentCreatedProject, onboardingContext]);

  const handleGoBack = useCallback(
    (goToStepIndex?: number) => {
      if (!stepObj) {
        return;
      }

      const previousStep = defined(goToStepIndex)
        ? onboardingSteps[goToStepIndex]
        : onboardingSteps[stepIndex - 1];

      if (!previousStep) {
        return;
      }

      if (stepObj.cornerVariant !== previousStep.cornerVariant) {
        cornerVariantControl.start('none');
      }

      trackAnalytics('onboarding.back_button_clicked', {
        organization,
        from: onboardingSteps[stepIndex]!.id,
        to: previousStep.id,
      });

      // from selected platform to welcome
      if (onboardingSteps[stepIndex]!.id === 'select-platform') {
        onboardingContext.setData({...onboardingContext.data, selectedSDK: undefined});

        props.router.replace(
          normalizeUrl(`/onboarding/${organization.slug}/${previousStep.id}/`)
        );
        return;
      }

      // from setup docs to selected platform
      if (onboardingSteps[stepIndex]!.id === 'setup-docs' && shallProjectBeDeleted) {
        trackAnalytics('onboarding.data_removal_modal_confirm_button_clicked', {
          organization,
          platform: recentCreatedProject.slug,
          project_id: recentCreatedProject.id,
        });
        deleteRecentCreatedProject();
      }

      props.router.replace(
        normalizeUrl(`/onboarding/${organization.slug}/${previousStep.id}/`)
      );
    },
    [
      stepObj,
      stepIndex,
      onboardingSteps,
      organization,
      cornerVariantControl,
      props.router,
      onboardingContext,
      shallProjectBeDeleted,
      deleteRecentCreatedProject,
      recentCreatedProject,
    ]
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
          onboardingContext.setData({...onboardingContext.data, selectedSDK: undefined});
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

  const goBackDeletionAlertModalProps: OpenConfirmOptions = {
    message: t(
      "Hey, just a heads up - we haven't received any data for this SDK yet and by going back all changes will be discarded. Are you sure you want to head back?"
    ),
    priority: 'danger',
    confirmText: t("Yes I'm sure"),
    onConfirm: handleGoBack,
    onClose: () => {
      if (!recentCreatedProject) {
        return;
      }

      trackAnalytics('onboarding.data_removal_modal_dismissed', {
        organization,
        platform: recentCreatedProject.slug,
        project_id: recentCreatedProject.id,
      });
    },
    onRender: () => {
      if (!recentCreatedProject) {
        return;
      }

      trackAnalytics('onboarding.data_removal_modal_rendered', {
        organization,
        platform: recentCreatedProject.slug,
        project_id: recentCreatedProject.id,
      });
    },
  };

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
                openConfirmModal({
                  ...goBackDeletionAlertModalProps,
                  // @ts-expect-error TS(2345): Argument of type 'number | MouseEvent<HTMLDivEleme... Remove this comment to see the full error message
                  onConfirm: () => handleGoBack(i),
                });
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
        <Confirm bypass={!shallProjectBeDeleted} {...goBackDeletionAlertModalProps}>
          <Back animate={stepIndex > 0 ? 'visible' : 'hidden'} />
        </Confirm>
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

interface BackButtonProps extends Omit<ButtonProps, 'icon' | 'priority'> {
  animate: MotionProps['animate'];
  className?: string;
}

const Back = styled(({className, animate, ...props}: BackButtonProps) => (
  <motion.div
    className={className}
    animate={animate}
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
    <Button {...props} icon={<IconArrow direction="left" />} priority="link">
      {t('Back')}
    </Button>
  </motion.div>
))`
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
