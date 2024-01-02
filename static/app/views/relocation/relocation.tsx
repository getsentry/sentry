import {useCallback, useEffect, useRef, useState} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {AnimatePresence, motion, MotionProps, useAnimation} from 'framer-motion';

import {Button, ButtonProps} from 'sentry/components/button';
import LoadingError from 'sentry/components/loadingError';
import LogoSentry from 'sentry/components/logoSentry';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import Redirect from 'sentry/utils/redirect';
import testableTransition from 'sentry/utils/testableTransition';
import useApi from 'sentry/utils/useApi';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import PageCorners from 'sentry/views/onboarding/components/pageCorners';
import Stepper from 'sentry/views/onboarding/components/stepper';
import {RelocationOnboardingContextProvider} from 'sentry/views/relocation/relocationOnboardingContext';

import EncryptBackup from './encryptBackup';
import GetStarted from './getStarted';
import PublicKey from './publicKey';
import {StepDescriptor} from './types';
import UploadBackup from './uploadBackup';

type RouteParams = {
  step: string;
};

type Props = RouteComponentProps<RouteParams, {}>;

function getRelocationOnboardingSteps(): StepDescriptor[] {
  return [
    {
      id: 'get-started',
      title: t('Get Started'),
      Component: GetStarted,
      cornerVariant: 'top-left',
    },
    {
      id: 'public-key',
      title: t("Save Sentry's public key to your machine"),
      Component: PublicKey,
      cornerVariant: 'top-left',
    },
    {
      id: 'encrypt-backup',
      title: t('Encrypt backup'),
      Component: EncryptBackup,
      cornerVariant: 'top-left',
    },
    {
      id: 'upload-backup',
      title: t('Upload backup'),
      Component: UploadBackup,
      cornerVariant: 'top-left',
    },
  ];
}

function RelocationOnboarding(props: Props) {
  const [hasPublicKeyError, setHasError] = useState(false);

  // TODO(getsentry/team-ospo#214): We should use sessionStorage to track this, since it should not
  // change during a single run through this workflow.
  const [publicKey, setPublicKey] = useState('');

  const api = useApi();
  const fetchData = useCallback(() => {
    const endpoint = `/publickeys/relocations/`;
    return api
      .requestPromise(endpoint)
      .then(response => {
        setPublicKey(response.public_key);
        setHasError(false);
      })
      .catch(_error => {
        setPublicKey('');
        setHasError(true);
      });
  }, [api]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const loadingError = (
    <LoadingError message={t('Failed to load your public key.')} onRetry={fetchData} />
  );

  const {
    params: {step: stepId},
  } = props;

  const onboardingSteps = getRelocationOnboardingSteps();
  const stepObj = onboardingSteps.find(({id}) => stepId === id);
  const stepIndex = onboardingSteps.findIndex(({id}) => stepId === id);

  const cornerVariantTimeoutRed = useRef<number | undefined>(undefined);

  useEffect(() => {
    return () => {
      window.clearTimeout(cornerVariantTimeoutRed.current);
    };
  }, []);

  const cornerVariantControl = useAnimation();
  const updateCornerVariant = () => {
    // TODO(getsentry/team-ospo#214): Find a better way to delay the corner animation.
    window.clearTimeout(cornerVariantTimeoutRed.current);

    cornerVariantTimeoutRed.current = window.setTimeout(
      () => cornerVariantControl.start(stepIndex === 0 ? 'top-right' : 'top-left'),
      1000
    );
  };

  useEffect(updateCornerVariant, [stepIndex, cornerVariantControl]);

  // Called onExitComplete
  const updateAnimationState = () => {
    if (!stepObj) {
      return;
    }
  };

  const goToStep = (step: StepDescriptor) => {
    if (!stepObj) {
      return;
    }
    if (step.cornerVariant !== stepObj.cornerVariant) {
      cornerVariantControl.start('none');
    }
    props.router.push(normalizeUrl(`/relocation/${step.id}/`));
  };

  const goNextStep = useCallback(
    (step: StepDescriptor) => {
      const currentStepIndex = onboardingSteps.findIndex(s => s.id === step.id);
      const nextStep = onboardingSteps[currentStepIndex + 1];

      if (step.cornerVariant !== nextStep.cornerVariant) {
        cornerVariantControl.start('none');
      }

      props.router.push(normalizeUrl(`/relocation/${nextStep.id}/`));
    },
    [onboardingSteps, cornerVariantControl, props.router]
  );

  if (!stepObj || stepIndex === -1) {
    return <Redirect to={normalizeUrl(`/relocation/${onboardingSteps[0].id}/`)} />;
  }

  return (
    <OnboardingWrapper data-test-id="relocation-onboarding">
      <RelocationOnboardingContextProvider>
        <SentryDocumentTitle title={stepObj.title} />
        <Header>
          <LogoSvg />
          {stepIndex !== -1 && (
            <StyledStepper
              numSteps={onboardingSteps.length}
              currentStepIndex={stepIndex}
              onClick={i => {
                goToStep(onboardingSteps[i]);
              }}
            />
          )}
        </Header>
        <Container>
          <Back
            onClick={() => goToStep(onboardingSteps[stepIndex - 1])}
            animate={stepIndex > 0 ? 'visible' : 'hidden'}
          />
          <AnimatePresence exitBeforeEnter onExitComplete={updateAnimationState}>
            <OnboardingStep
              key={stepObj.id}
              data-test-id={`onboarding-step-${stepObj.id}`}
            >
              {stepObj.Component && (
                <stepObj.Component
                  active
                  data-test-id={`onboarding-step-${stepObj.id}`}
                  stepIndex={stepIndex}
                  onComplete={() => {
                    if (stepObj) {
                      goNextStep(stepObj);
                    }
                  }}
                  publicKey={publicKey}
                  route={props.route}
                  router={props.router}
                  location={props.location}
                />
              )}
            </OnboardingStep>
          </AnimatePresence>
          <AdaptivePageCorners animateVariant={cornerVariantControl} />
          {stepObj.id === 'public-key' && hasPublicKeyError ? loadingError : null}
        </Container>
      </RelocationOnboardingContextProvider>
    </OnboardingWrapper>
  );
}

const Container = styled('div')`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
  position: relative;
  background: #faf9fb;
  padding: 120px ${space(3)};
  width: 100%;
  margin: 0 auto;
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

OnboardingStep.defaultProps = {
  initial: 'initial',
  animate: 'animate',
  exit: 'exit',
  variants: {animate: {}},
  transition: testableTransition({
    staggerChildren: 0.2,
  }),
};

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

const OnboardingWrapper = styled('main')`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
`;

export default RelocationOnboarding;
