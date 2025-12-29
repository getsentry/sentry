import {Fragment, useState} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import SelectField from 'sentry/components/forms/fields/selectField';
import Form from 'sentry/components/forms/form';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {Organization} from 'sentry/types/organization';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

type CategoryInfo = {
  api_name: string;
  billed_category: number;
  display_name: string;
  name: string;
  order: number;
  product_name: string;
  singular: string;
  tally_type: number;
};

type BillingConfig = {
  category_info: Record<string, CategoryInfo>;
  outcomes: Record<string, string>;
  reason_codes: Record<string, string>;
};

type Props = {
  onSuccess: () => void;
  organization: Organization;
};

type ModalProps = Props & ModalRenderProps;

function DeleteBillingMetricHistoryModal({
  onSuccess,
  organization,
  closeModal,
  Header,
  Body,
}: ModalProps) {
  const api = useApi();
  const [dataCategory, setDataCategory] = useState<number | null>(null);
  const orgSlug = organization.slug;

  const {data: billingConfig = null, isPending: isLoadingBillingConfig} =
    useApiQuery<BillingConfig>(['/api/0/billing-config/'], {
      staleTime: Infinity,
    });

  if (isLoadingBillingConfig || !billingConfig) {
    return (
      <Fragment>
        <Header closeButton>Delete Billing Metric History</Header>
        <Body>
          <LoadingIndicator />
        </Body>
      </Fragment>
    );
  }

  const dataCategoryChoices = Object.entries(billingConfig.category_info).map(
    ([key, value]) => {
      const billingMetric = Number(key);
      return [billingMetric, `${value.display_name} (${billingMetric})`] as [
        number,
        string,
      ];
    }
  );
  const onSubmit = () => {
    if (dataCategory === null) {
      addErrorMessage('Please select a data category.');
      return;
    }

    api.request(`/api/0/customers/${orgSlug}/delete-billing-metric-history/`, {
      method: 'POST',
      data: {
        data_category: dataCategory,
      },
      success: () => {
        addSuccessMessage('Successfully deleted billing metric history.');
        closeModal();
        onSuccess();
      },
      error: error => {
        const errorMsg =
          error.responseJSON?.detail || 'Unable to delete billing metric history.';
        addErrorMessage(errorMsg);
      },
    });
  };

  return (
    <Fragment>
      <Header closeButton>Delete Billing Metric History</Header>
      <Body>
        <div>Delete billing metric history for a specific data category.</div>
        <br />
        <Form onSubmit={onSubmit} submitLabel="Delete" onCancel={closeModal}>
          <SelectField
            inline={false}
            stacked
            flexibleControlStateSize
            label="Data Category"
            name="data_category"
            value={dataCategory}
            onChange={(value: number) => {
              setDataCategory(value);
            }}
            choices={dataCategoryChoices}
            required
            help="Warning: This action cannot be undone. The selected billing metric history will be permanently deleted."
          />
        </Form>
      </Body>
    </Fragment>
  );
}

type Options = Pick<Props, 'onSuccess' | 'organization'>;

const deleteBillingMetricHistory = (opts: Options) =>
  openModal(deps => <DeleteBillingMetricHistoryModal {...deps} {...opts} />, {
    closeEvents: 'escape-key',
  });

export default deleteBillingMetricHistory;
