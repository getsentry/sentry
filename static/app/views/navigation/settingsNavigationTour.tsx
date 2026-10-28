import {createContext, useContext, useState, type ReactNode} from 'react';

import {useHotkeys} from '@sentry/scraps/hotkey';
import {Flex} from '@sentry/scraps/layout';
import {useModal} from '@sentry/scraps/modal';

import {TourAction, TourGuide, TextTourAction} from 'sentry/components/tours/components';
import {t} from 'sentry/locale';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {useNavigationTour} from 'sentry/views/navigation/navigationTour';
import {usePrimaryNavigation} from 'sentry/views/navigation/primaryNavigationContext';
import {useSettingsNavigation} from 'sentry/views/navigation/useSettingsNavigation';
import {useSettingsV3} from 'sentry/views/settings/useSettingsV3';

const STEPS = ['entry', 'org', 'project', 'account', 'back'] as const;
type Step = (typeof STEPS)[number];

const SettingsNavigationTourContext = createContext<{
  dismiss: () => void;
  next: () => void;
  previous: () => void;
  step: Step | null;
} | null>(null);

export function SettingsNavigationTourProvider({children}: {children: ReactNode}) {
  const organization = useOrganization({allowNull: true});
  const user = useUser();
  const enabled = useSettingsV3();
  const inSettings = useSettingsNavigation();
  const {layout} = usePrimaryNavigation();
  const {currentStepId} = useNavigationTour();
  const {visible} = useModal();
  const navigate = useNavigate();
  const [completed, setCompleted] = useLocalStorageState(
    'settings-navigation-tour:' + user.id,
    false
  );
  const [requestedStep, setStep] = useState<Step>(inSettings ? 'org' : 'entry');
  const step = inSettings ? (requestedStep === 'entry' ? 'org' : requestedStep) : 'entry';
  const active =
    enabled &&
    !!organization &&
    layout === 'sidebar' &&
    !completed &&
    !currentStepId &&
    !visible;
  const dismiss = () => setCompleted(true);
  const next = () => {
    const nextStep = STEPS[STEPS.indexOf(step) + 1];
    if (!nextStep) {
      dismiss();
      return;
    }
    if (step === 'entry' && organization) {
      navigate('/settings/' + organization.slug + '/');
    }
    setStep(nextStep);
  };
  const previous = () =>
    setStep(STEPS[Math.max(inSettings ? 1 : 0, STEPS.indexOf(step) - 1)] ?? step);

  useHotkeys(active ? [{match: 'Escape', callback: dismiss}] : []);

  return (
    <SettingsNavigationTourContext
      value={{step: active ? step : null, dismiss, next, previous}}
    >
      {children}
    </SettingsNavigationTourContext>
  );
}

export function SettingsNavigationTourElement({
  id,
  children,
  title,
  description,
}: {
  children: React.ComponentProps<typeof TourGuide>['children'];
  description: ReactNode;
  id: Step;
  title: ReactNode;
}) {
  const context = useContext(SettingsNavigationTourContext);
  return (
    <TourGuide
      title={title}
      description={description}
      isOpen={context?.step === id}
      position={id === 'entry' ? 'bottom-start' : 'right-start'}
      stepCount={STEPS.indexOf(id) + 1}
      stepTotal={STEPS.length}
      handleDismiss={context?.dismiss}
      actions={
        <Flex gap="md" align="center">
          <TextTourAction size="xs" onClick={context?.dismiss}>
            {t('Skip tour')}
          </TextTourAction>
          {id !== 'entry' && id !== 'org' && (
            <TextTourAction size="xs" onClick={context?.previous}>
              {t('Previous')}
            </TextTourAction>
          )}
          <TourAction size="xs" onClick={context?.next}>
            {id === 'back' ? t('Done') : t('Next')}
          </TourAction>
        </Flex>
      }
    >
      {children}
    </TourGuide>
  );
}
