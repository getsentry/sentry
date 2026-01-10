import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {
  addLoadingMessage,
  addSuccessMessage,
  clearIndicators,
} from 'sentry/actionCreators/indicator';
import BooleanField from 'sentry/components/forms/fields/booleanField';
import DateTimeField from 'sentry/components/forms/fields/dateTimeField';
import EmailField from 'sentry/components/forms/fields/emailField';
import SelectField from 'sentry/components/forms/fields/selectField';
import TextareaField from 'sentry/components/forms/fields/textareaField';
import TextField from 'sentry/components/forms/fields/textField';
import type {FormProps} from 'sentry/components/forms/form';
import Form from 'sentry/components/forms/form';
import FormField from 'sentry/components/forms/formField';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelItem from 'sentry/components/panels/panelItem';
import {space} from 'sentry/styles/space';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';

import PageHeader from 'admin/components/pageHeader';
import type {Subscription} from 'getsentry/types';

const PLAN_CHOICES = [
  ['m1_baa', 'Medium (BAA)'],
  ['l1', 'Large'],
  ['e1', 'Enterprise'],
];

const PERIOD_CHOICES = [
  ['monthly', 'Monthly'],
  ['annual', 'Annual'],
];

function CustomerUpgradeRequest() {
  const {orgId} = useParams<{orgId: string}>();
  const {
    data: customer,
    isPending,
    isError,
  } = useApiQuery<Subscription>([`/customers/${orgId}/`], {staleTime: 0});
  const api = useApi({persistInFlight: true});
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState<string>();

  const onSubmit: FormProps['onSubmit'] = (data, onSubmitSuccess, onSubmitError) => {
    addLoadingMessage('Saving Changes...');

    api.request(`/customers/${orgId}/upgrade-request/`, {
      method: 'POST',
      data: {
        ...data,
        // dont send events unless we're on enterprise plan
        events: data.plan === 'e1' ? data.events : undefined,
      },
      success: result => {
        clearIndicators();
        onSubmitSuccess(result);
        addSuccessMessage('An upgrade request was submitted to the provisioning team.');
        navigate(`/_admin/customers/${orgId}/`);
      },
      error: error => {
        clearIndicators();
        onSubmitError(error);
      },
    });
  };

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError) {
    return <LoadingError />;
  }

  if (customer === null) {
    return null;
  }

  return (
    <Fragment>
      <PageHeader
        title="Customers"
        breadcrumbs={['Customer Upgrade Request', customer.name]}
      />
      <Panel>
        <PanelBody>
          <Form
            initialData={{
              events: '10m',
              contractStartDate: moment().format(moment.HTML5_FMT.DATETIME_LOCAL),
              type: 'invoiced',
              softCap: true,
            }}
            onSubmit={onSubmit}
            submitLabel="Submit Upgrade Request"
          >
            <FormField name="account" label="Account">
              {() => `${customer.slug} (${customer.name})`}
            </FormField>
            <SelectField
              label="Plan"
              name="plan"
              choices={PLAN_CHOICES}
              clearable={false}
              required
              onChange={(v: any) => setSelectedPlan(v)}
            />
            {selectedPlan === 'e1' && (
              <TextField
                label="Total Events"
                name="events"
                placeholder="10m"
                required
                help="The total event volume for this account, in millions."
              />
            )}
            <SelectField
              label="Billing Period"
              name="billingPeriod"
              choices={PERIOD_CHOICES}
              clearable={false}
              required
              help="How often are they charged?"
            />
            <SelectField
              label="Contract Period"
              name="contractPeriod"
              choices={PERIOD_CHOICES}
              clearable={false}
              required
              help="How long is their contract for?"
            />
            <DateTimeField
              label="Contract Start"
              name="contractStartDate"
              required
              help="The date at which this change should take effect."
            />
            <SelectField
              label="Invoiced?"
              name="type"
              clearable={false}
              choices={[
                ['invoiced', 'Yes'],
                ['credit_card', 'No (paid via credit card on file)'],
              ]}
              required
              help="Should this account be billed via invoice?"
            />
            <BooleanField
              label="Soft Cap"
              name="softCap"
              required
              help="Enable a soft cap for this account's usage."
            />

            <Divider>Additional Details</Divider>

            <TextField
              label="ACV"
              name="acv"
              placeholder="$50000"
              required
              help="The annual contract value for this account."
            />
            <TextField
              label="Contact Name"
              name="contactName"
              placeholder="Jane Doe"
              required
              help="The name of the primary contact within the organization."
            />
            <EmailField
              label="Contact Email"
              name="contactEmail"
              placeholder="jane.doe@example.com"
              required
              help="The email address the primary contact within the organization."
            />
            <TextField
              label="Salesforce link"
              name="sfdcLink"
              required
              placeholder="https://..."
            />
            <TextareaField label="Additional Notes" name="notes" required={false} />
          </Form>
        </PanelBody>
      </Panel>
    </Fragment>
  );
}

const Divider = styled(PanelItem)`
  font-size: ${p => p.theme.fontSize.md};
  padding: ${space(1.5)} ${space(2)};
  background: ${p => p.theme.backgroundSecondary};
  color: ${p => p.theme.tokens.content.secondary};
`;

export default CustomerUpgradeRequest;
