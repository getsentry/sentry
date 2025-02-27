import {Button} from 'sentry/components/button';
import {t} from 'sentry/locale';
import IndicatorStore from 'sentry/stores/indicatorStore';
import type {Organization} from 'sentry/types/organization';

import TrialStarter from 'getsentry/components/trialStarter';

type ButtonProps = React.ComponentProps<typeof Button>;

type Props = React.PropsWithChildren<
  {
    organization: Organization;
    source: string;
    analyticsData?: Record<string, any>;
    handleClick?: () => void;
    onTrialFailed?: () => void;
    onTrialStarted?: () => void;
    requestData?: Record<string, unknown>;
  } & ButtonProps
>;

function StartTrialButton({
  children,
  organization,
  source,
  onTrialStarted,
  onTrialFailed,
  handleClick,
  requestData,
  analyticsData: _,
  ...buttonProps
}: Props) {
  return (
    <TrialStarter
      source={source}
      organization={organization}
      onTrialFailed={() => {
        IndicatorStore.addError(t('Error starting trial. Please try again.'));
        onTrialFailed?.();
      }}
      onTrialStarted={onTrialStarted}
      requestData={requestData}
    >
      {({startTrial, trialStarting, trialStarted}) => (
        <Button
          disabled={trialStarting || trialStarted}
          data-test-id="start-trial-button"
          onClick={() => {
            handleClick?.();
            startTrial();
          }}
          {...buttonProps}
        >
          {children || t('Start trial')}
        </Button>
      )}
    </TrialStarter>
  );
}

export default StartTrialButton;
