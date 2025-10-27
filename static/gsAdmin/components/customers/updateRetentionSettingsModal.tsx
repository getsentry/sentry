import {Fragment, useState} from 'react';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {openModal} from 'sentry/actionCreators/modal';
import NumberField from 'sentry/components/forms/fields/numberField';
import Form from 'sentry/components/forms/form';
import type {Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';

import type {Subscription} from 'getsentry/types';

type Props = {
  onSuccess: () => void;
  organization: Organization;
  subscription: Subscription;
};

type ModalProps = Props & ModalRenderProps;

function UpdateRetentionSettingsModal({
  onSuccess,
  organization,
  subscription,
  closeModal,
  Header,
  Body,
}: ModalProps) {
  const api = useApi();

  const [spansStandard, setSpansStandard] = useState<number | null | string>(
    subscription.categories.spans?.retention?.standard ?? null
  );
  const [spansDownsampled, setSpansDownsampled] = useState<number | null | string>(
    subscription.categories.spans?.retention?.downsampled ?? null
  );
  const [logBytesStandard, setLogBytesStandard] = useState<number | null | string>(
    subscription.categories.logBytes?.retention?.standard ?? null
  );
  const [logBytesDownsampled, setLogBytesDownsampled] = useState<number | null | string>(
    subscription.categories.logBytes?.retention?.downsampled ?? null
  );

  const onSubmit = () => {
    const data = {
      retentions: {
        spans: {
          standard: Number(spansStandard),
          downsampled: spansDownsampled === '' ? null : Number(spansDownsampled),
        },
        logBytes: {
          standard: Number(logBytesStandard),
          downsampled: logBytesDownsampled === '' ? null : Number(logBytesDownsampled),
        },
      },
    };

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
            name="spansStandard"
            label="Spans Standard"
            defaultValue={spansStandard}
            onChange={setSpansStandard}
            required
          />
          <NumberField
            name="spansDownsampled"
            label="Spans Downsampled"
            defaultValue={spansDownsampled}
            onChange={setSpansDownsampled}
          />
          <NumberField
            name="logBytesStandard"
            label="Logs Standard"
            defaultValue={logBytesStandard}
            onChange={setLogBytesStandard}
            required
          />
          <NumberField
            name="logBytesDownsampled"
            label="Logs Downsampled"
            defaultValue={logBytesDownsampled}
            onChange={setLogBytesDownsampled}
          />
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
