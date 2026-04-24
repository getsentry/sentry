import {useMutation} from '@tanstack/react-query';
import {z} from 'zod';

import {defaultFormOptions, setFieldErrors, useScrapsForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {fetchOrganizationDetails} from 'sentry/actionCreators/organization';
import {Client} from 'sentry/api';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useRouteAnalyticsParams} from 'sentry/utils/routeAnalytics/useRouteAnalyticsParams';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {SubscriptionContext} from 'getsentry/components/subscriptionContext';
import {withSubscription} from 'getsentry/components/withSubscription';
import {SubscriptionStore} from 'getsentry/stores/subscriptionStore';
import type {Subscription} from 'getsentry/types';
import {isDisabledByPartner} from 'getsentry/utils/partnerships';
import {SubscriptionPageContainer} from 'getsentry/views/subscriptionPage/components/subscriptionPageContainer';
import {PartnershipNote} from 'getsentry/views/subscriptionPage/partnershipNote';

const schema = z.object({
  code: z.string().min(1, t('Promotional code is required')),
});

function RedeemPromoCode({subscription}: {subscription: Subscription}) {
  const organization = useOrganization();

  const {accountBalance} = subscription;
  const accountCredit =
    accountBalance < 0 ? Number((accountBalance / -100).toFixed(2)) : 0;
  useRouteAnalyticsParams({
    account_credit: accountCredit,
  });

  const mutation = useMutation({
    mutationFn: (data: {code: string}) =>
      fetchMutation<{details?: string}>({
        url: `/customers/${organization.slug}/redeem-promo/`,
        method: 'PUT',
        data,
      }),
    onSuccess: resp => {
      const msg = resp?.details || t('Successfully applied credit to your organization');

      SubscriptionStore.loadData(organization.slug, null, {
        markStartedTrial: true,
      });
      fetchOrganizationDetails(new Client(), organization.slug);
      addSuccessMessage(msg);
    },
    onError: error => {
      if (error instanceof RequestError) {
        setFieldErrors(form, error);

        // non-field errors can be camelcase or snake case
        const nonFieldErrors =
          error.responseJSON?.non_field_errors || error.responseJSON?.nonFieldErrors;

        if (Array.isArray(nonFieldErrors) && nonFieldErrors.length) {
          addErrorMessage(nonFieldErrors[0], {duration: 10000});
        }
      } else {
        addErrorMessage(t('Unable to redeem promo code'));
      }
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {code: ''},
    validators: {onDynamic: schema},
    onSubmit: ({value}) => {
      return mutation
        .mutateAsync(value)
        .then(() => form.reset())
        .catch(() => {});
    },
  });

  if (isDisabledByPartner(subscription)) {
    return (
      <SubscriptionPageContainer background="secondary">
        <PartnershipNote subscription={subscription} />
      </SubscriptionPageContainer>
    );
  }
  return (
    <SubscriptionPageContainer background="secondary">
      <SubscriptionContext>
        <SentryDocumentTitle title={t('Redeem Promo Code')} orgSlug={organization.slug} />
        <SettingsPageHeader title={t('Redeem Promotional Code')} />
        <form.AppForm form={form}>
          <form.FieldGroup title={t('Redeem Promotional Code')}>
            <form.AppField name="code">
              {field => (
                <field.Layout.Row
                  label={t('Promotional Code')}
                  hintText={t(
                    'Received a promotional code? Enter it here to apply credit to your organization.'
                  )}
                  required
                >
                  <field.Input value={field.state.value} onChange={field.handleChange} />
                </field.Layout.Row>
              )}
            </form.AppField>

            <Flex justify={accountCredit > 0 ? 'between' : 'end'}>
              {accountCredit > 0 ? (
                <Text>
                  {tct('Your account credit: $[credit]', {credit: String(accountCredit)})}
                </Text>
              ) : null}
              <form.SubmitButton>{t('Redeem')}</form.SubmitButton>
            </Flex>
          </form.FieldGroup>
        </form.AppForm>
      </SubscriptionContext>
    </SubscriptionPageContainer>
  );
}

export default withSubscription(RedeemPromoCode);
