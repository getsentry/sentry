import {Fragment, useState} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import SelectField from 'sentry/components/forms/fields/selectField';
import Form from 'sentry/components/forms/form';
import {t} from 'sentry/locale';
import useApi from 'sentry/utils/useApi';

import type {Subscription} from 'getsentry/types';

type Props = {
  onSuccess: () => void;
  subscription: Subscription;
};

enum VercelEndpoint {
  SUBMIT_BILLING_DATA = 'submit_billing_data',
  SUBMIT_INVOICE = 'submit_invoice',
  CREATE_EVENT = 'create_event',
}

type AdminTestVercelApiRequest = {
  extra: string | null;
  organization_id: number;
  vercel_endpoint: VercelEndpoint;
};

type ModalProps = Props & ModalRenderProps;

function TestVercelApiEndpointModal({
  onSuccess,
  subscription,
  closeModal,
  Header,
  Body,
}: ModalProps) {
  const api = useApi();
  const [endpoint, setEndpoint] = useState<VercelEndpoint>(
    VercelEndpoint.SUBMIT_BILLING_DATA
  );
  const [extra, setExtra] = useState<string | null>(null);

  const onSubmit = () => {
    const data: AdminTestVercelApiRequest = {
      extra: endpoint === VercelEndpoint.SUBMIT_INVOICE ? extra : null,
      organization_id: Number(subscription.id),
      vercel_endpoint: endpoint,
    };

    api.request(`/_admin/test-vercel-api/`, {
      method: 'POST',
      data,
      success: () => {
        addSuccessMessage('Sent billing data to Vercel API.');
        closeModal();
        onSuccess();
      },
      error: () => {
        addErrorMessage('Unable to send request to Vercel API.');
      },
    });
  };

  return (
    <Fragment>
      <Header closeButton>Test Vercel API Endpoint</Header>
      <Body>
        <div>Test Vercel API endpoints for development and debugging purposes.</div>
        <br />
        <Form onSubmit={onSubmit} submitLabel={t('Send Request')} onCancel={closeModal}>
          <SelectField
            inline={false}
            stacked
            flexibleControlStateSize
            label="Vercel Endpoint"
            name="vercel_endpoint"
            value={endpoint}
            onChange={(value: VercelEndpoint) => {
              setEndpoint(value);
            }}
            required
            choices={Object.values(VercelEndpoint)}
          />
          {endpoint === VercelEndpoint.SUBMIT_INVOICE && (
            <SelectField
              inline={false}
              stacked
              flexibleControlStateSize
              label="Invoice Result"
              name="invoice_result"
              value={extra}
              onChange={(value: string) => {
                setExtra(value);
              }}
              required
              choices={['paid', 'notpaid']}
            />
          )}
        </Form>
      </Body>
    </Fragment>
  );
}

type Options = Pick<Props, 'onSuccess' | 'subscription'>;

const testVercelApiEndpoint = (opts: Options) =>
  openModal(deps => <TestVercelApiEndpointModal {...deps} {...opts} />, {
    closeEvents: 'escape-key',
  });

export default testVercelApiEndpoint;
