import {Fragment, useState} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import {SelectField} from 'sentry/components/forms/fields/selectField';
import {Form} from 'sentry/components/forms/form';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import {useApi} from 'sentry/utils/useApi';

import type {Subscription} from 'getsentry/types';

type Props = {
  onSuccess: () => void;
  organization: Organization;
  subscription: Subscription;
};

type ModalProps = Props & ModalRenderProps;

const RETENTION_STEP_DAYS = 30;
const MAX_RETENTION_DAYS = 390;

const RETENTION_DAY_CHOICES = Array.from(
  {length: MAX_RETENTION_DAYS / RETENTION_STEP_DAYS},
  (_, i) => (i + 1) * RETENTION_STEP_DAYS
);

type RetentionOption = {label: string; value: number};

/**
 * Retention must be picked from multiples of 30. Existing values
 * that predate this restriction are kept as an option so they aren't silently
 * dropped when the form is submitted.
 */
function getRetentionOptions(currentValue: number | null): RetentionOption[] {
  const options: RetentionOption[] = RETENTION_DAY_CHOICES.map(days => ({
    value: days,
    label: days === currentValue ? `${days} days (current)` : `${days} days`,
  }));

  if (currentValue !== null && !options.some(option => option.value === currentValue)) {
    options.unshift({value: currentValue, label: `${currentValue} days (current)`});
  }

  return options;
}

type RetentionFieldProps = {
  label: string;
  name: string;
  onChange: (value: number | null) => void;
  value: number | null;
};

function RetentionField({name, label, value, onChange}: RetentionFieldProps) {
  const [options] = useState(() => getRetentionOptions(value));

  return (
    <SelectField
      name={name}
      label={label}
      defaultValue={value}
      options={options}
      onChange={(newValue: number | null | undefined) => onChange(newValue ?? null)}
      placeholder="Plan default"
      allowClear
    />
  );
}

function UpdateRetentionSettingsModal({
  onSuccess,
  organization,
  subscription,
  closeModal,
  Header,
  Body,
}: ModalProps) {
  const api = useApi();

  const [orgStandard, setOrgStandard] = useState<number | null>(
    subscription.orgRetention?.standard ?? null
  );

  const [logBytesStandard, setLogBytesStandard] = useState<number | null>(
    subscription.categories.logBytes?.retention?.standard ?? null
  );
  const [logBytesDownsampled, setLogBytesDownsampled] = useState<number | null>(
    subscription.categories.logBytes?.retention?.downsampled ?? null
  );

  const [transactionsStandard, setTransactionsStandard] = useState<number | null>(
    subscription.categories.transactions?.retention?.standard ?? null
  );
  const [transactionsDownsampled, setTransactionsDownsampled] = useState<number | null>(
    subscription.categories.transactions?.retention?.downsampled ?? null
  );

  const [spansStandard, setSpansStandard] = useState<number | null>(
    subscription.categories.spans?.retention?.standard ?? null
  );
  const [spansDownsampled, setSpansDownsampled] = useState<number | null>(
    subscription.categories.spans?.retention?.downsampled ?? null
  );

  const onSubmit = () => {
    const retentions: Partial<
      Record<DataCategory, {downsampled: number | null; standard: number | null}>
    > = {};

    if (subscription.planDetails.categories.includes(DataCategory.LOG_BYTE)) {
      retentions.logBytes = {
        standard: logBytesStandard,
        downsampled: logBytesDownsampled,
      };
    }

    if (subscription.planDetails.categories.includes(DataCategory.TRANSACTIONS)) {
      retentions.transactions = {
        standard: transactionsStandard,
        downsampled: transactionsDownsampled,
      };
    }

    if (subscription.planDetails.categories.includes(DataCategory.SPANS)) {
      retentions.spans = {
        standard: spansStandard,
        downsampled: spansDownsampled,
      };
    }

    const orgRetention = {
      standard: orgStandard,
      downsampled: null,
    };

    const data = {retentions, orgRetention};

    api.request(`/_admin/customers/${organization.slug}/retention-settings/`, {
      method: 'POST',
      data,
      success: () => {
        addSuccessMessage('Retention settings updated successfully.');
        closeModal();
        onSuccess();
      },
      error: e => {
        addErrorMessage(e.responseText || 'Failed to update retention settings.');
      },
    });
  };

  return (
    <Fragment>
      <Header closeButton>Update Retention Settings</Header>
      <Body>
        <div>
          <p>
            Update the retention settings for each data category. Retention must be a
            multiple of 30 days. Clearing a field defaults to the plan's retention value
            for the category.
          </p>
        </div>
        <br />
        <Form onSubmit={onSubmit} submitLabel="Update Settings" onCancel={closeModal}>
          <RetentionField
            name="orgStandard"
            label="Org Retention"
            value={orgStandard}
            onChange={setOrgStandard}
          />
          {subscription.planDetails.categories.includes(DataCategory.LOG_BYTE) && (
            <Fragment>
              <RetentionField
                name="logBytesStandard"
                label="Logs Standard"
                value={logBytesStandard}
                onChange={setLogBytesStandard}
              />
              <RetentionField
                name="logBytesDownsampled"
                label="Logs Downsampled"
                value={logBytesDownsampled}
                onChange={setLogBytesDownsampled}
              />
            </Fragment>
          )}

          {subscription.planDetails.categories.includes(DataCategory.TRANSACTIONS) && (
            <Fragment>
              <RetentionField
                name="transactionsStandard"
                label="Transactions Standard"
                value={transactionsStandard}
                onChange={setTransactionsStandard}
              />
              <RetentionField
                name="transactionsDownsampled"
                label="Transactions Downsampled"
                value={transactionsDownsampled}
                onChange={setTransactionsDownsampled}
              />
            </Fragment>
          )}

          {subscription.planDetails.categories.includes(DataCategory.SPANS) && (
            <Fragment>
              <RetentionField
                name="spansStandard"
                label="Spans Standard"
                value={spansStandard}
                onChange={setSpansStandard}
              />
              <RetentionField
                name="spansDownsampled"
                label="Spans Downsampled"
                value={spansDownsampled}
                onChange={setSpansDownsampled}
              />
            </Fragment>
          )}
        </Form>
      </Body>
    </Fragment>
  );
}

type Options = Pick<Props, 'onSuccess' | 'organization' | 'subscription'>;

export const openUpdateRetentionSettingsModal = (opts: Options) =>
  openModal(deps => <UpdateRetentionSettingsModal {...deps} {...opts} />, {
    closeEvents: 'escape-key',
  });
