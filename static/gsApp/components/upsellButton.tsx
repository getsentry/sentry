import {Button} from 'sentry/components/button';
import {IconBusiness} from 'sentry/icons';
import type {Organization} from 'sentry/types/organization';

import UpsellProvider from 'getsentry/components/upsellProvider';
import type {Subscription} from 'getsentry/types';

type Props = Pick<
  React.ComponentProps<typeof UpsellProvider>,
  'source' | 'extraAnalyticsParams'
> &
  Omit<React.ComponentProps<typeof Button>, 'aria-label'> & {
    organization?: Organization;
    subscription?: Subscription;
  };

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
        <Button onClick={onClick} icon={<IconBusiness />} {...rest}>
          {defaultButtonText}
        </Button>
      )}
    </UpsellProvider>
  );
}

export default UpsellButton;
