import {Fragment, useState} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import NumberField from 'sentry/components/forms/fields/numberField';
import Form from 'sentry/components/forms/form';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';

import type {Subscription} from 'getsentry/types';

type Props = {
  onSuccess: () => void;
  organization: Organization;
  subscription: Subscription;
};

type ModalProps = Props & ModalRenderProps;

function getNumberOrNull(n: number | null | string): number | null {
  return n === null || n === '' ? null : Number(n);
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

  const [orgStandard, setOrgStandard] = useState<number | null | string>(
    subscription.orgRetention?.standard ?? null
  );

  const [logBytesStandard, setLogBytesStandard] = useState<number | null | string>(
    subscription.categories.logBytes?.retention?.standard ?? null
  );
  const [logBytesDownsampled, setLogBytesDownsampled] = useState<number | null | string>(
    subscription.categories.logBytes?.retention?.downsampled ?? null
  );

  const [transactionsStandard, setTransactionsStandard] = useState<
    number | null | string
  >(subscription.categories.transactions?.retention?.standard ?? null);
  const [transactionsDownsampled, setTransactionsDownsampled] = useState<
    number | null | string
  >(subscription.categories.transactions?.retention?.downsampled ?? null);

  const [spansStandard, setSpansStandard] = useState<number | null | string>(
    subscription.categories.spans?.retention?.standard ?? null
  );
  const [spansDownsampled, setSpansDownsampled] = useState<number | null | string>(
    subscription.categories.spans?.retention?.downsampled ?? null
  );

  const onSubmit = () => {
    const retentions: Partial<
      Record<DataCategory, {downsampled: number | null; standard: number | null}>
    > = {};

    if (subscription.planDetails.categories.includes(DataCategory.LOG_BYTE)) {
      retentions.logBytes = {
        standard: getNumberOrNull(logBytesStandard),
        downsampled: getNumberOrNull(logBytesDownsampled),
      };
    }

    if (subscription.planDetails.categories.includes(DataCategory.TRANSACTIONS)) {
      retentions.transactions = {
        standard: getNumberOrNull(transactionsStandard),
        downsampled: getNumberOrNull(transactionsDownsampled),
      };
    }

    if (subscription.planDetails.categories.includes(DataCategory.SPANS)) {
      retentions.spans = {
        standard: getNumberOrNull(spansStandard),
        downsampled: getNumberOrNull(spansDownsampled),
      };
    }

    const orgRetention = {
      standard: getNumberOrNull(orgStandard),
      downsampled: null,
    };

    const data = {retentions, orgRetention};

    api.request(`/_admin/${organization.slug}/retention-settings/`, {
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
            Update the retention settings for each data category. Null values will default
            to the plan's retention value for the category.
          </p>
          <p>
            A value of zero for downsampled means that the downsampled retention defaults
            to the standard retention.
          </p>
        </div>
        <br />
        <Form onSubmit={onSubmit} submitLabel="Update Settings" onCancel={closeModal}>
          <NumberField
            name="orgStandard"
            label="Org Retention"
            defaultValue={orgStandard}
            onChange={setOrgStandard}
          />
          {subscription.planDetails.categories.includes(DataCategory.LOG_BYTE) && (
            <Fragment>
              <NumberField
                name="logBytesStandard"
                label="Logs Standard"
                defaultValue={logBytesStandard}
                onChange={setLogBytesStandard}
              />
              <NumberField
                name="logBytesDownsampled"
                label="Logs Downsampled"
                defaultValue={logBytesDownsampled}
                onChange={setLogBytesDownsampled}
              />
            </Fragment>
          )}

          {subscription.planDetails.categories.includes(DataCategory.TRANSACTIONS) && (
            <Fragment>
              <NumberField
                name="transactionsStandard"
                label="Transactions Standard"
                defaultValue={transactionsStandard}
                onChange={setTransactionsStandard}
              />
              <NumberField
                name="transactionsDownsampled"
                label="Transactions Downsampled"
                defaultValue={transactionsDownsampled}
                onChange={setTransactionsDownsampled}
              />
            </Fragment>
          )}

          {subscription.planDetails.categories.includes(DataCategory.SPANS) && (
            <Fragment>
              <NumberField
                name="spansStandard"
                label="Spans Standard"
                defaultValue={spansStandard}
                onChange={setSpansStandard}
              />
              <NumberField
                name="spansDownsampled"
                label="Spans Downsampled"
                defaultValue={spansDownsampled}
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

const openUpdateRetentionSettingsModal = (opts: Options) =>
  openModal(deps => <UpdateRetentionSettingsModal {...deps} {...opts} />, {
    closeEvents: 'escape-key',
  });

export default openUpdateRetentionSettingsModal;
