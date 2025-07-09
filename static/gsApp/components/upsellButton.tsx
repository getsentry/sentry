import {Button, type ButtonProps} from 'sentry/components/core/button';
import {IconBusiness} from 'sentry/icons';
import type {Organization} from 'sentry/types/organization';

import UpsellProvider from 'getsentry/components/upsellProvider';
import type {Subscription} from 'getsentry/types';

interface Props
  extends Omit<ButtonProps, 'aria-label'>,
    Pick<React.ComponentProps<typeof UpsellProvider>, 'source' | 'extraAnalyticsParams'> {
  organization?: Organization;
  subscription?: Subscription;
}

function UpsellButton({
  source,
  extraAnalyticsParams,
  subscription,
  organization,
  ...rest
}: Props) {
  return (
    <UpsellProvider
      source={source}
      organization={organization}
      triggerMemberRequests
      extraAnalyticsParams={extraAnalyticsParams}
      subscription={subscription}
    >
      {({onClick, defaultButtonText}) => (
        <Button onClick={onClick} redesign icon={<IconBusiness redesign />} {...rest}>
          {defaultButtonText}
        </Button>
      )}
    </UpsellProvider>
  );
}

export default UpsellButton;
