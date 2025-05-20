import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {updateOrganization} from 'sentry/actionCreators/organizations';
import Form from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import useOrganization from 'sentry/utils/useOrganization';

import withSubscription from 'getsentry/components/withSubscription';
import {useGenAiConsentButtonAccess} from 'getsentry/hooks/genAiAccess';
import type {Subscription} from 'getsentry/types';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import DataConsentFields from 'getsentry/views/legalAndCompliance/dataConsent';

function DataConsentForm({subscription}: {subscription: Subscription}) {
  const organization = useOrganization();
  const endpoint = `/organizations/${organization.slug}/data-consent/`;

  const {
    isDisabled: isGenAiButtonDisabled,
    message: genAiButtonMessage,
    hasBillingAccess,
    isSuperuser,
    isTouchCustomerAndNeedsMsaUpdate,
  } = useGenAiConsentButtonAccess({
    subscription,
  });

  const initialData = {
    aggregatedDataConsent: organization.aggregatedDataConsent,
  };

  return (
    <Form
      data-test-id="data-consent"
      apiMethod="PUT"
      apiEndpoint={endpoint}
      saveOnBlur
      allowUndo
      initialData={initialData}
      onSubmitError={() => {
        addErrorMessage(t('Unable to save change'));
      }}
      onSubmitSuccess={(updatedOrganization: Partial<Organization>) => {
        updateOrganization({id: organization.id, ...updatedOrganization});
      }}
      onFieldChange={(name, value) => {
        trackGetsentryAnalytics('data_consent_settings.updated', {
          organization,
          setting: name,
          value,
        });
      }}
    >
      <JsonForm
        additionalFieldProps={{
          isGenAiButtonDisabled,
          genAiButtonMessage,
          hasBillingAccess,
          isSuperuser,
          isTouchCustomerAndNeedsMsaUpdate,
        }}
        forms={DataConsentFields}
      />
    </Form>
  );
}

export default withSubscription(DataConsentForm);
