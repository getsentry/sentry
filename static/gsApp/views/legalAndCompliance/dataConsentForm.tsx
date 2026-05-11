import {mutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {ExternalLink} from '@sentry/scraps/link';

import {updateOrganization} from 'sentry/actionCreators/organizations';
import {t, tct} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useUser} from 'sentry/utils/useUser';

import {withSubscription} from 'getsentry/components/withSubscription';
import {BillingType, type Subscription} from 'getsentry/types';
import {trackGetsentryAnalytics} from 'getsentry/utils/trackGetsentryAnalytics';
import {DataConsentSettingsHeader} from 'getsentry/views/legalAndCompliance/utils';

const dataConsentSchema = z.object({
  aggregatedDataConsent: z.boolean(),
});

export function DataConsentForm({subscription}: {subscription: Subscription}) {
  const organization = useOrganization();
  const user = useUser();
  const endpoint = getApiUrl('/organizations/$organizationIdOrSlug/data-consent/', {
    path: {organizationIdOrSlug: organization.slug},
  });

  const isTouchCustomer = subscription.type === BillingType.INVOICED;
  const hasMsaUpdated =
    defined(subscription.msaUpdatedForDataConsent) &&
    subscription.msaUpdatedForDataConsent;
  const isTouchCustomerAndNeedsMsaUpdate = isTouchCustomer && !hasMsaUpdated;
  const hasBillingAccess = organization.access.includes('org:billing');

  const isDisabled =
    (isTouchCustomerAndNeedsMsaUpdate || !hasBillingAccess) && !user?.isSuperuser;

  const disabled = isDisabled
    ? isTouchCustomerAndNeedsMsaUpdate
      ? t(
          'These changes require updates to your account. Please contact your customer success manager to learn more.'
        )
      : t("You don't have access to manage these billing and subscription details.")
    : false;

  const mutationOpts = mutationOptions({
    mutationFn: (data: Partial<Organization>) =>
      fetchMutation<Partial<Organization>>({method: 'PUT', url: endpoint, data}),
    onSuccess: (updatedOrganization, variables) => {
      updateOrganization({id: organization.id, ...updatedOrganization});
      trackGetsentryAnalytics('data_consent_settings.updated', {
        organization,
        setting: 'aggregatedDataConsent',
        value: variables.aggregatedDataConsent,
      });
    },
  });

  return (
    <FieldGroup title={t('Service Data Usage')}>
      <DataConsentSettingsHeader />
      <AutoSaveForm
        name="aggregatedDataConsent"
        schema={dataConsentSchema}
        initialValue={organization.aggregatedDataConsent ?? false}
        mutationOptions={mutationOpts}
      >
        {field => (
          <field.Layout.Row
            label={t('Use of aggregated identifying data')}
            hintText={tct(
              'Toggle on to let Sentry use your error messages, stack traces, spans, and DOM interactions data for issue workflow and other product improvements. [learnMorelink:Learn more].',
              {
                learnMorelink: (
                  <ExternalLink href="https://docs.sentry.io/product/security/ai-ml-policy/#use-of-aggregated-identifying-data" />
                ),
              }
            )}
          >
            <field.Switch
              checked={field.state.value}
              onChange={field.handleChange}
              disabled={disabled}
            />
          </field.Layout.Row>
        )}
      </AutoSaveForm>
    </FieldGroup>
  );
}

export default withSubscription(DataConsentForm);
