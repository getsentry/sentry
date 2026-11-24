import {IconBusiness} from '@sentry/icons/business';

import {Button, type ButtonProps} from '@sentry/scraps/button';

import type {Organization} from 'sentry/types/organization';

import {UpsellProvider} from 'getsentry/components/upsellProvider';

interface Props
  extends
    Omit<ButtonProps, 'aria-label'>,
    Pick<React.ComponentProps<typeof UpsellProvider>, 'source' | 'extraAnalyticsParams'> {
  organization?: Organization;
}

export function UpsellButton({
  source,
  extraAnalyticsParams,
  organization,
  ...rest
}: Props) {
  return (
    <UpsellProvider
      source={source}
      organization={organization}
      triggerMemberRequests
      extraAnalyticsParams={extraAnalyticsParams}
    >
      {({onClick, defaultButtonText}) => (
        <Button onClick={onClick} icon={<IconBusiness />} {...rest}>
          {defaultButtonText}
        </Button>
      )}
    </UpsellProvider>
  );
}
