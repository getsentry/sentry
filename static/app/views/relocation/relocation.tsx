import {useCallback, useEffect, useRef, useState} from 'react';
import type {RouteComponentProps} from 'react-router';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import type {MotionProps} from 'framer-motion';
import {AnimatePresence, motion, useAnimation} from 'framer-motion';

import type {ButtonProps} from 'sentry/components/button';
import {Button} from 'sentry/components/button';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import LogoSentry from 'sentry/components/logoSentry';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
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
import InProgress from './inProgress';
import PublicKey from './publicKey';
import type {StepDescriptor} from './types';
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
    {
      id: 'in-progress',
      title: t('Your relocation is in progress'),
      Component: InProgress,
      cornerVariant: 'top-left',
    },
  ];
}

enum LoadingState {
  FETCHED,
  FETCHING,
  ERROR,
}

function RelocationOnboarding(props: Props) {
  const {
    params: {step: stepId},
  } = props;
  const onboardingSteps = getRelocationOnboardingSteps();
  const stepObj = onboardingSteps.find(({id}) => stepId === id);
  const stepIndex = onboardingSteps.findIndex(({id}) => stepId === id);
  const api = useApi();
  const regions = ConfigStore.get('regions');

  const [existingRelocationState, setExistingRelocationState] = useState(
    LoadingState.FETCHING
  );
  const [existingRelocation, setExistingRelocation] = useState('');

  // TODO(getsentry/team-ospo#214): We should use sessionStorage to track this, since it should not
  // change during a single run through this workflow.
  const [publicKey, setPublicKey] = useState('');
  const [publicKeyState, setPublicKeyState] = useState(LoadingState.FETCHING);

  const fetchExistingRelocation = useCallback(() => {
    setExistingRelocationState(LoadingState.FETCHING);
    return Promise.all(
      regions.map(region =>
        api.requestPromise(`/relocations/`, {
          method: 'GET',
          host: region.url,
        })
      )
    )
      .then(responses => {
        const response = responses.flat(1);
        response.sort((a, b) => {
          return (
            new Date(a.dateAdded || 0).getTime() - new Date(b.dateAdded || 0).getTime()
          );
        });
        const existingRelocationUUID =
          response.find(
            candidate =>
              candidate.status === 'IN_PROGRESS' || candidate.status === 'PAUSE'
          )?.uuid || '';

        setExistingRelocation(existingRelocationUUID);
        setExistingRelocationState(LoadingState.FETCHED);
        if (existingRelocationUUID !== '' && stepId !== 'in-progress') {
          browserHistory.push('/relocation/in-progress/');
        }
        if (existingRelocationUUID === '' && stepId === 'in-progress') {
          browserHistory.push('/relocation/get-started/');
        }
      })
      .catch(_error => {
        setExistingRelocation('');
        setExistingRelocationState(LoadingState.ERROR);
      });
  }, [api, regions, stepId]);
  useEffect(() => {
    fetchExistingRelocation();
  }, [fetchExistingRelocation]);

  const fetchPublicKey = useCallback(() => {
    const endpoint = `/publickeys/relocations/`;
    setPublicKeyState(LoadingState.FETCHING);

    return api
      .requestPromise(endpoint)
      .then(response => {
        setPublicKey(response.public_key);
        setPublicKeyState(LoadingState.FETCHED);
      })
      .catch(_error => {
        setPublicKey('');
        setPublicKeyState(LoadingState.ERROR);
      });
  }, [api]);
  useEffect(() => {
    fetchPublicKey();
  }, [fetchPublicKey]);

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

  const headerView =
    stepId === 'in-progress' ? null : (
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
    );

  const backButtonView =
    stepId === 'in-progress' ? null : (
      <Back
        onClick={() => goToStep(onboardingSteps[stepIndex - 1])}
        animate={stepIndex > 0 ? 'visible' : 'hidden'}
      />
    );

  const isLoading =
    existingRelocationState !== LoadingState.FETCHED ||
    publicKeyState !== LoadingState.FETCHED;
  const contentView = isLoading ? (
    <LoadingIndicator />
  ) : (
    <AnimatePresence exitBeforeEnter onExitComplete={updateAnimationState}>
      <OnboardingStep key={stepObj.id} data-test-id={`onboarding-step-${stepObj.id}`}>
        {stepObj.Component && (
          <stepObj.Component
            active
            data-test-id={`onboarding-step-${stepObj.id}`}
            existingRelocationUUID={existingRelocation}
            stepIndex={stepIndex}
            onComplete={(uuid?) => {
              if (uuid) {
                setExistingRelocation(uuid);
              }
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
  );

  const hasErr =
    existingRelocationState === LoadingState.ERROR ||
    publicKeyState === LoadingState.ERROR;
  const errView = hasErr ? (
    <LoadingError
      data-test-id="loading-error"
      message={t('Failed to load information from server - check your connection?')}
      onRetry={() => {
        if (existingRelocationState) {
          fetchExistingRelocation();
        }
        if (publicKeyState) {
          fetchPublicKey();
        }
      }}
    />
  ) : null;

  return (
    <OnboardingWrapper data-test-id="relocation-onboarding">
      <RelocationOnboardingContextProvider>
        <SentryDocumentTitle title={stepObj.title} />
        {headerView}
        <Container>
          {backButtonView}
          {contentView}
          <AdaptivePageCorners animateVariant={cornerVariantControl} />
          {errView}
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
