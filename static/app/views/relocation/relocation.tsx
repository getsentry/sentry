import {useCallback, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import type {MotionProps} from 'framer-motion';
import {AnimatePresence, motion, useAnimation} from 'framer-motion';

import type {ButtonProps} from 'sentry/components/button';
import {Button} from 'sentry/components/button';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import LogoSentry from 'sentry/components/logoSentry';
import Redirect from 'sentry/components/redirect';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import {browserHistory} from 'sentry/utils/browserHistory';
import testableTransition from 'sentry/utils/testableTransition';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useApi from 'sentry/utils/useApi';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';
import PageCorners from 'sentry/views/onboarding/components/pageCorners';
import Stepper from 'sentry/views/onboarding/components/stepper';

import EncryptBackup from './encryptBackup';
import GetStarted from './getStarted';
import InProgress from './inProgress';
import PublicKey from './publicKey';
import type {MaybeUpdateRelocationState, RelocationState, StepDescriptor} from './types';
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
  FETCHED = 0,
  FETCHING = 1,
  ERROR = 2,
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
  const [publicKeys, setPublicKeys] = useState(new Map<string, string>());
  const [publicKeysState, setPublicKeysState] = useState(LoadingState.FETCHING);
  const [relocationState, setRelocationState] = useSessionStorage<RelocationState>(
    'relocationOnboarding',
    {
      orgSlugs: '',
      regionUrl: '',
      promoCode: '',
    }
  );

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

        // The user has a relocation already in flight - whatever page they asked for, show them the
        // progress of that relocation instead, since they can only have one relocation in flight at
        // a time.
        if (existingRelocationUUID !== '' && stepId !== 'in-progress') {
          browserHistory.push('/relocation/in-progress/');
        }

        // The user does not have a relocation in-flight, but tried to view the in progress screen.
        // Since we have nothing to show them, take them back to the start of the flow.
        if (existingRelocationUUID === '' && stepId === 'in-progress') {
          browserHistory.push('/relocation/get-started/');
        }

        // The user tried to view a later step, but at least one bit of required data was missing in
        // their local storage. Take them back to the first screen.
        const {orgSlugs, regionUrl} = relocationState;
        if (stepId !== 'get-started' && (!orgSlugs || !regionUrl)) {
          browserHistory.push('/relocation/get-started/');
        }

        setExistingRelocation(existingRelocationUUID);
        setExistingRelocationState(LoadingState.FETCHED);
      })
      .catch(_error => {
        setExistingRelocation('');
        setExistingRelocationState(LoadingState.ERROR);
      });
  }, [api, regions, relocationState, stepId]);
  useEffect(() => {
    fetchExistingRelocation();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fetchPublicKeys = useCallback(() => {
    setPublicKeysState(LoadingState.FETCHING);
    return Promise.all(
      regions.map(region =>
        api.requestPromise(`/publickeys/relocations/`, {
          method: 'GET',
          host: region.url,
        })
      )
    )
      .then(responses => {
        setPublicKeys(
          new Map<string, string>(
            regions.map((region, index) => [region.url, responses[index].public_key])
          )
        );
        setPublicKeysState(LoadingState.FETCHED);
      })
      .catch(_error => {
        setPublicKeys(new Map<string, string>());
        setPublicKeysState(LoadingState.ERROR);
      });
  }, [api, regions]);
  useEffect(() => {
    fetchPublicKeys();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
      const nextStep = onboardingSteps[currentStepIndex + 1]!;

      if (step.cornerVariant !== nextStep.cornerVariant) {
        cornerVariantControl.start('none');
      }

      props.router.push(normalizeUrl(`/relocation/${nextStep.id}/`));
    },
    [onboardingSteps, cornerVariantControl, props.router]
  );

  if (!stepObj || stepIndex === -1) {
    return <Redirect to={normalizeUrl(`/relocation/${onboardingSteps[0]!.id}/`)} />;
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
              // @ts-expect-error TS(2538): Type 'MouseEvent<HTMLDivElement, MouseEvent>' cann... Remove this comment to see the full error message
              goToStep(onboardingSteps[i]);
            }}
          />
        )}
      </Header>
    );

  const backButtonView =
    stepId === 'in-progress' ? null : (
      <Back
        onClick={() => goToStep(onboardingSteps[stepIndex - 1]!)}
        animate={stepIndex > 0 ? 'visible' : 'hidden'}
      />
    );

  const isLoading =
    existingRelocationState !== LoadingState.FETCHED ||
    publicKeysState !== LoadingState.FETCHED;
  const contentView = isLoading ? (
    <LoadingIndicator />
  ) : (
    <AnimatePresence mode="wait" onExitComplete={updateAnimationState}>
      <OnboardingStep key={stepObj.id} data-test-id={`onboarding-step-${stepObj.id}`}>
        {stepObj.Component && (
          <stepObj.Component
            active
            data-test-id={`onboarding-step-${stepObj.id}`}
            existingRelocationUUID={existingRelocation}
            stepIndex={stepIndex}
            onUpdateRelocationState={({
              orgSlugs,
              regionUrl,
              promoCode,
            }: MaybeUpdateRelocationState) => {
              setRelocationState({
                orgSlugs: orgSlugs === undefined ? relocationState.orgSlugs : orgSlugs,
                regionUrl:
                  regionUrl === undefined ? relocationState.regionUrl : regionUrl,
                promoCode:
                  promoCode === undefined ? relocationState.promoCode : promoCode,
              });
            }}
            onComplete={(uuid?) => {
              if (uuid) {
                setExistingRelocation(uuid);
              }
              if (stepObj) {
                goNextStep(stepObj);
              }
            }}
            publicKeys={publicKeys}
            relocationState={relocationState}
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
    publicKeysState === LoadingState.ERROR;
  const errView = hasErr ? (
    <LoadingError
      data-test-id="loading-error"
      message={t('Failed to load information from server - check your connection?')}
      onRetry={() => {
        if (existingRelocationState === LoadingState.ERROR) {
          fetchExistingRelocation();
        }
        if (publicKeysState === LoadingState.ERROR) {
          fetchPublicKeys();
        }
      }}
    />
  ) : null;

  return (
    <OnboardingWrapper data-test-id="relocation-onboarding">
      <SentryDocumentTitle title={stepObj.title} />
      {headerView}
      <Container>
        {backButtonView}
        {contentView}
        <AdaptivePageCorners animateVariant={cornerVariantControl} />
        {errView}
      </Container>
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

  p,
  a {
    line-height: 1.6;
  }
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

const OnboardingStep = styled((props: React.ComponentProps<typeof motion.div>) => (
  <motion.div
    initial="initial"
    animate="animate"
    exit="exit"
    variants={{animate: {}}}
    transition={testableTransition({
      staggerChildren: 0.2,
    })}
    {...props}
  />
))`
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

const OnboardingWrapper = styled('main')`
  flex-grow: 1;
  display: flex;
  flex-direction: column;
`;

export default RelocationOnboarding;
