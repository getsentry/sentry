import {Fragment, useState} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import InputField from 'sentry/components/forms/fields/inputField';
import NumberField from 'sentry/components/forms/fields/numberField';
import SelectField from 'sentry/components/forms/fields/selectField';
import Form from 'sentry/components/forms/form';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useApiQuery} from 'sentry/utils/queryClient';
import useApi from 'sentry/utils/useApi';

function getDateString(date: Date): string {
  // returns date in YYYY-MM-DD format
  return date.toISOString().split('T')[0]!;
}

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

type AdminRecordUsageRequest = {
  data_category: number;
  // YYYY-MM-DD format
  date: string;
  outcome: number;
  project_id: number;
  quantity: number;
  reason_code: number;
};

type Props = {
  onSuccess: () => void;
  organization: Organization;
};

type ModalProps = Props & ModalRenderProps;

function AddBillingMetricUsageModal({
  onSuccess,
  organization,
  closeModal,
  Header,
  Body,
}: ModalProps) {
  const api = useApi();
  const [projectID, setProjectID] = useState<number | null>(null);
  const [dataCategory, setDataCategory] = useState<number | null>(null);
  const [quantity, setQuantity] = useState<number>(0);
  // set default outcome to 0 (ACCEPTED)
  const [outcome, setOutcome] = useState<number>(0);
  // set default reason code to 0 (DEFAULT)
  const [reason_code, setReasonCode] = useState<number>(0);
  const [date, setDate] = useState<Date>(new Date());
  const orgSlug = organization.slug;

  const {data: billingConfig = null, isPending: isLoadingBillingConfig} =
    useApiQuery<BillingConfig>(['/api/0/billing-config/'], {
      staleTime: Infinity,
    });

  const {data: projects = [], isPending: isLoadingProjects} = useApiQuery<Project[]>(
    [
      `/organizations/${orgSlug}/projects/`,
      {
        query: {all_projects: '1'},
      },
    ],
    {
      staleTime: Infinity,
    }
  );

  if (isLoadingBillingConfig || isLoadingProjects || !billingConfig) {
    return (
      <Fragment>
        <Header closeButton>Add Billing Metric Usage</Header>
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

  const outcomeChoices = Object.entries(billingConfig.outcomes).map(([key, value]) => {
    const outcomeID = Number(key);
    return [outcomeID, `${value} (${outcomeID})`] as [number, string];
  });

  const reasonCodeChoices = Object.entries(billingConfig.reason_codes).map(
    ([key, value]) => {
      const reasonCodeID = Number(key);
      return [reasonCodeID, `${value} (${reasonCodeID})`] as [number, string];
    }
  );

  const onSubmit = () => {
    if (projectID === null || dataCategory === null || quantity <= 0) {
      return;
    }

    const data: AdminRecordUsageRequest = {
      project_id: projectID,
      quantity,
      data_category: dataCategory,
      outcome,
      reason_code,
      date: getDateString(date),
    };

    api.request(`/customers/${orgSlug}/record-usage/`, {
      method: 'POST',
      data,
      success: () => {
        addSuccessMessage('Created billing metric usage.');
        closeModal();
        onSuccess();
      },
      error: () => {
        addErrorMessage('Unable to create billing metric usage.');
      },
    });
  };

  return (
    <Fragment>
      <Header closeButton>Add Billing Metric Usage</Header>
      <Body>
        <div>Create and add mock billing metric usage for testing purposes.</div>
        <br />
        <Form onSubmit={onSubmit} submitLabel="Create" onCancel={closeModal}>
          <SelectField
            inline={false}
            stacked
            flexibleControlStateSize
            label="Project"
            name="project"
            value={projectID}
            onChange={(value: number) => {
              setProjectID(value);
            }}
            choices={projects.map(project => [
              Number(project.id),
              `${project.slug} - ${project.name}`,
            ])}
            required
          />
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
          />
          <NumberField
            inline={false}
            stacked
            flexibleControlStateSize
            label="Quantity"
            help={
              <Fragment>Enter amount of usage for the chosen data category.</Fragment>
            }
            name="quantity"
            value={quantity}
            defaultValue={quantity}
            min={0}
            onChange={(value: number) => {
              setQuantity(value);
            }}
            required
          />
          <SelectField
            inline={false}
            stacked
            flexibleControlStateSize
            label="Outcome"
            name="outcome"
            value={outcome}
            defaultValue={outcome}
            onChange={(value: number) => {
              setOutcome(value);
            }}
            choices={outcomeChoices}
            required
          />
          <SelectField
            inline={false}
            stacked
            flexibleControlStateSize
            label="Reason Code"
            name="reason_code"
            value={reason_code}
            defaultValue={reason_code}
            onChange={(value: number) => {
              setReasonCode(value);
            }}
            choices={reasonCodeChoices}
            required
          />
          <InputField
            inline={false}
            stacked
            flexibleControlStateSize
            label="Date"
            name="date"
            type="date"
            required
            defaultValue={getDateString(date)}
            max={getDateString(new Date())}
            onChange={(value: any) => {
              setDate(new Date(value));
            }}
          />
        </Form>
      </Body>
    </Fragment>
  );
}

type Options = Pick<Props, 'onSuccess' | 'organization'>;

const addBillingMetricUsage = (opts: Options) =>
  openModal(deps => <AddBillingMetricUsageModal {...deps} {...opts} />, {
    closeEvents: 'escape-key',
  });

export default addBillingMetricUsage;
