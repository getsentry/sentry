import {
  Button,
  LinkButton,
  type ButtonProps,
  type LinkButtonProps,
} from '@sentry/scraps/button';

import {t} from 'sentry/locale';
import IndicatorStore from 'sentry/stores/indicatorStore';
import type {Organization} from 'sentry/types/organization';

import TrialStarter from 'getsentry/components/trialStarter';

type StartTrialButtonProps = React.PropsWithChildren<{
  organization: Organization;
  source: string;
  analyticsData?: Record<string, any>;
  handleClick?: () => void;
  onTrialFailed?: () => void;
  onTrialStarted?: () => void;
  requestData?: Record<string, unknown>;
}> &
  (Omit<ButtonProps, 'children'> | Omit<LinkButtonProps, 'children'>);

export default function StartTrialButton({
  children,
  organization,
  source,
  onTrialStarted,
  onTrialFailed,
  handleClick,
  requestData,
  analyticsData: _,
  ...buttonProps
}: StartTrialButtonProps) {
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
      {({startTrial, trialStarting, trialStarted}) => {
        if (
          ('to' in buttonProps && buttonProps.to !== undefined) ||
          ('href' in buttonProps && buttonProps.href !== undefined)
        ) {
          const {onClick, ...restButtonProps} = buttonProps as LinkButtonProps;
          return (
            <LinkButton
              disabled={trialStarting || trialStarted}
              data-test-id="start-trial-button"
              onClick={e => {
                handleClick?.();
                startTrial();
                onClick?.(e);
              }}
              {...(restButtonProps as LinkButtonProps)}
            >
              {children || t('Start trial')}
            </LinkButton>
          );
        }

        const {onClick, ...restButtonProps} = buttonProps as ButtonProps;

        return (
          <Button
            disabled={trialStarting || trialStarted}
            data-test-id="start-trial-button"
            onClick={e => {
              handleClick?.();
              startTrial();
              onClick?.(e);
            }}
            {...(restButtonProps as ButtonProps)}
          >
            {children || t('Start trial')}
          </Button>
        );
      }}
    </TrialStarter>
  );
}
