import {useQuery} from '@tanstack/react-query';
import {z} from 'zod';

import {AlertLink} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, FieldGroup, useScrapsForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Redirect} from 'sentry/components/redirect';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {IconInfo} from 'sentry/icons';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {withSubscription} from 'getsentry/components/withSubscription';
import type {Subscription} from 'getsentry/types';
import {displayBudgetName} from 'getsentry/utils/billing';
import {ContactBillingMembers} from 'getsentry/views/contactBillingMembers';
import {SubscriptionPageContainer} from 'getsentry/views/subscriptionPage/components/subscriptionPageContainer';
import {hasSpendVisibilityNotificationsFeature} from 'getsentry/views/subscriptionPage/utils';

interface SubscriptionNotificationsProps {
  subscription: Subscription;
}

type ThresholdsType = {
  perProductOndemandPercent: number[];
  reservedPercent: number[];
};

function getThresholdsSchema(onDemandEnabled: boolean) {
  return z.object({
    reservedPercent: z.array(z.number()).min(1, t('At least one threshold is required')),
    perProductOndemandPercent: onDemandEnabled
      ? z.array(z.number()).min(1, t('At least one threshold is required'))
      : z.array(z.number()),
  });
}

const THRESHOLD_OPTIONS = [90, 80, 70, 60, 50, 40, 30, 20, 10].map(value => ({
  label: `${value}%`,
  value,
}));

function SubscriptionNotifications({subscription}: SubscriptionNotificationsProps) {
  const organization = useOrganization();

  const {
    data: backendThresholds,
    isPending,
    refetch,
    isError,
  } = useQuery({
    ...apiOptions.as<ThresholdsType>()(
      '/customers/$organizationIdOrSlug/spend-notifications/',
      {
        path: {organizationIdOrSlug: organization.slug},
        staleTime: 0,
      }
    ),
    gcTime: 0,
  });

  const hasBillingPerms = organization.access?.includes('org:billing');

  if (!hasSpendVisibilityNotificationsFeature(organization)) {
    return <Redirect to={`/settings/${organization.slug}/billing/overview/`} />;
  }

  return (
    <SubscriptionPageContainer background="primary">
      <SentryDocumentTitle
        title={t('Manage Spend Notifications')}
        orgSlug={organization.slug}
      />
      <SettingsPageHeader
        title={t('Manage Spend Notifications')}
        subtitle={t(
          "Receive notifications when your organization's usage exceeds a threshold"
        )}
      />
      <Flex direction="column" gap="2xl">
        <AlertLink
          to="/settings/account/notifications/quota/"
          variant="info"
          trailingItems={<IconInfo />}
        >
          {t(
            'To adjust your personal billing notification settings, please go to Fine Tune Alerts in your account settings.'
          )}
        </AlertLink>
        {hasBillingPerms ? (
          isPending ? (
            <LoadingIndicator />
          ) : isError ? (
            <LoadingError onRetry={refetch} />
          ) : (
            <ThresholdsForm
              backendThresholds={backendThresholds}
              subscription={subscription}
              onSuccess={refetch}
            />
          )
        ) : (
          <ContactBillingMembers />
        )}
      </Flex>
    </SubscriptionPageContainer>
  );
}

function ThresholdsForm({
  backendThresholds,
  subscription,
  onSuccess,
}: {
  backendThresholds: ThresholdsType;
  onSuccess: () => Promise<unknown>;
  subscription: Subscription;
}) {
  const organization = useOrganization();
  const onDemandEnabled = subscription.planDetails.allowOnDemand;

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: backendThresholds,
    validators: {onDynamic: getThresholdsSchema(onDemandEnabled)},
    onSubmit: async ({value}) => {
      try {
        await fetchMutation({
          url: `/customers/${organization.slug}/spend-notifications/`,
          method: 'POST',
          data: value,
        });
        addSuccessMessage(t('Threshold notifications saved successfully.'));
        await onSuccess();
        form.reset();
      } catch {
        addErrorMessage(t('Unable to save threshold notifications.'));
      }
    },
  });

  return (
    <form.AppForm form={form}>
      <FieldGroup title={t('Notification Thresholds')}>
        <form.AppField name="reservedPercent">
          {field => (
            <field.Layout.Row
              label={t('Subscription consumption')}
              hintText={t('Applies to all reserved volumes in your subscription')}
            >
              <field.Select
                multiple
                clearable
                value={field.state.value}
                options={THRESHOLD_OPTIONS}
                onChange={field.handleChange}
              />
            </field.Layout.Row>
          )}
        </form.AppField>
        {onDemandEnabled && (
          <form.AppField name="perProductOndemandPercent">
            {field => (
              <field.Layout.Row
                label={t(
                  '%s consumption',
                  displayBudgetName(subscription.planDetails, {title: true})
                )}
                hintText={
                  '% ' +
                  t(
                    'of %s usage, up to your set limit',
                    displayBudgetName(subscription.planDetails)
                  )
                }
              >
                <field.Select
                  multiple
                  clearable
                  value={field.state.value}
                  options={THRESHOLD_OPTIONS}
                  onChange={field.handleChange}
                />
              </field.Layout.Row>
            )}
          </form.AppField>
        )}
        <Flex gap="md" justify="end">
          <Button onClick={() => form.reset()}>{t('Reset')}</Button>
          <form.SubmitButton>{t('Save changes')}</form.SubmitButton>
        </Flex>
      </FieldGroup>
    </form.AppForm>
  );
}

export default withSubscription(SubscriptionNotifications);
