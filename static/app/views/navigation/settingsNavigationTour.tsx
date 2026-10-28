import {createContext, useContext, useState, type ReactNode} from 'react';

import {useHotkeys} from '@sentry/scraps/hotkey';
import {Flex} from '@sentry/scraps/layout';
import {useModal} from '@sentry/scraps/modal';

import {TourAction, TourGuide, TextTourAction} from 'sentry/components/tours/components';
import {t} from 'sentry/locale';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';
import {useNavigationTour} from 'sentry/views/navigation/navigationTour';
import {usePrimaryNavigation} from 'sentry/views/navigation/primaryNavigationContext';
import {useSettingsNavigation} from 'sentry/views/navigation/useSettingsNavigation';
import {useSettingsV3} from 'sentry/views/settings/useSettingsV3';

const STEPS = ['entry', 'projects'] as const;
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
  const [completed, setCompleted] = useLocalStorageState(
    'settings-navigation-tour:' + user.id,
    false
  );
  const [step, setStep] = useState<Step>('entry');
  const active =
    enabled &&
    !!organization &&
    layout === 'sidebar' &&
    !inSettings &&
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
    setStep(nextStep);
  };
  const previous = () => setStep('entry');

  useHotkeys(active ? [{match: 'Escape', callback: dismiss}] : []);

  return (
    <SettingsNavigationTourContext
      value={{step: active ? step : null, dismiss, next, previous}}
    >
      {children}
    </SettingsNavigationTourContext>
  );
}

export function useSettingsNavigationTour() {
  return useContext(SettingsNavigationTourContext);
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
      density="comfortable"
      width={395}
      highlight={false}
      title={title}
      description={description}
      isOpen={context?.step === id}
      position={id === 'entry' ? 'bottom-start' : 'right'}
      stepCount={STEPS.indexOf(id) + 1}
      stepTotal={STEPS.length}
      handleDismiss={context?.dismiss}
      actions={
        <Flex data-settings-navigation-tour gap="md" align="center">
          {id === 'entry' && (
            <TextTourAction size="xs" onClick={context?.dismiss}>
              {t('Skip tour')}
            </TextTourAction>
          )}
          {id === 'projects' && (
            <TextTourAction size="xs" onClick={context?.previous}>
              {t('Previous')}
            </TextTourAction>
          )}
          <TourAction size="xs" onClick={context?.next}>
            {id === 'projects' ? t('Done') : t('Next')}
          </TourAction>
        </Flex>
      }
    >
      {children}
    </TourGuide>
  );
}
