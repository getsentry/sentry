import {useCallback} from 'react';
import moment from 'moment-timezone';

import {addErrorMessage, addLoadingMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import FieldFromConfig from 'sentry/components/forms/fieldFromConfig';
import Form from 'sentry/components/forms/form';
import type {Field, OnSubmitCallback} from 'sentry/components/forms/types';
import type {Broadcast} from 'sentry/types/system';
import {useMutation} from 'sentry/utils/queryClient';
import {safeURL} from 'sentry/utils/url/safeURL';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';

interface CreateBroadcastModal extends ModalRenderProps {
  fields: Field[];
}

export function CreateBroadcastModal({
  Header,
  Body,
  closeModal,
  fields,
}: CreateBroadcastModal) {
  const navigate = useNavigate();
  const api = useApi();

  const {mutate: updateBroadcast} = useMutation({
    mutationFn: (data: Broadcast) => {
      return api.requestPromise(`/broadcasts/`, {
        method: 'POST',
        data,
      });
    },
    onSuccess: (data: Broadcast) => {
      navigate(`/_admin/broadcasts/${data.id}/`);
    },
    onError: () => {
      addErrorMessage('An error occurred while submitting this form.');
    },
  });

  const handleSubmit: OnSubmitCallback = useCallback(
    (data, _onSubmitSuccess, onSubmitError) => {
      addLoadingMessage('Saving form\u2026');
      const errors: Partial<Record<keyof Broadcast, [string]>> = {};

      if (!safeURL(data.link)) {
        errors.link = ['Invalid URL'];
      }

      if (data.mediaUrl && !safeURL(data.mediaUrl)) {
        errors.mediaUrl = ['Invalid image URL'];
      }

      if (Object.keys(errors).length) {
        onSubmitError({responseJSON: errors});
        return;
      }

      const newData = {
        ...(data as Broadcast),
        category: data.category || undefined,
        mediaUrl: data.mediaUrl || undefined,
        region: data.region || undefined,
      };

      updateBroadcast(newData);
    },

    [updateBroadcast]
  );

  return (
    <Form
      onSubmit={handleSubmit}
      onCancel={closeModal}
      saveOnBlur={false}
      initialData={{
        isActive: true,
        dateExpires: moment().add(7, 'days').format('YYYY-MM-DDTHH:mm'),
      }}
      submitLabel="Save"
    >
      <Header>
        <h4>Add Broadcast</h4>
      </Header>
      <Body>
        {fields.map(field => (
          <FieldFromConfig
            key={field.name}
            field={field}
            flexibleControlStateSize
            inline={false}
            stacked
          />
        ))}
      </Body>
    </Form>
  );
}
