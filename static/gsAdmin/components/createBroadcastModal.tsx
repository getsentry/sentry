import {Fragment} from 'react';
import {useMutation} from '@tanstack/react-query';
import moment from 'moment-timezone';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {BackendJsonSubmitForm} from 'sentry/components/backendJsonFormAdapter/backendJsonSubmitForm';
import type {JsonFormAdapterFieldConfig} from 'sentry/components/backendJsonFormAdapter/types';
import type {Broadcast} from 'sentry/types/system';
import {fetchMutation} from 'sentry/utils/queryClient';
import {safeURL} from 'sentry/utils/url/safeURL';
import {useNavigate} from 'sentry/utils/useNavigate';
interface CreateBroadcastModal extends ModalRenderProps {
  fields: JsonFormAdapterFieldConfig[];
}

export function CreateBroadcastModal({
  Header,
  Body,
  Footer,
  closeModal,
  fields,
}: CreateBroadcastModal) {
  const navigate = useNavigate();
  const updateBroadcast = useMutation({
    mutationFn: (data: Record<string, unknown>) => {
      return fetchMutation<Broadcast>({
        url: '/broadcasts/',
        method: 'POST',
        data,
      });
    },
    onSuccess: data => {
      navigate(`/_admin/broadcasts/${data.id}/`);
    },
    onError: () => {
      addErrorMessage('An error occurred while submitting this form.');
    },
  });

  const handleSubmit = (data: Record<string, unknown>) => {
    const link = typeof data.link === 'string' ? data.link : '';
    const mediaUrl = typeof data.mediaUrl === 'string' ? data.mediaUrl : '';
    if (!safeURL(link)) {
      addErrorMessage('Enter a valid URL.');
      return Promise.reject(new Error('Invalid URL'));
    }

    if (mediaUrl && !safeURL(mediaUrl)) {
      addErrorMessage('Enter a valid image URL.');
      return Promise.reject(new Error('Invalid image URL'));
    }

    const newData: Record<string, unknown> = {
      ...data,
      link,
      category: data.category || undefined,
      mediaUrl: mediaUrl || undefined,
      region: data.region || undefined,
      organizations:
        typeof data.organizations === 'string'
          ? data.organizations
              .split(',')
              .map(s => Number(s.trim()))
              .filter(n => n > 0)
          : undefined,
    };

    return updateBroadcast.mutateAsync(newData);
  };

  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h3">Add Broadcast</Heading>
      </Header>
      <Body>
        <BackendJsonSubmitForm
          fields={fields}
          onSubmit={handleSubmit}
          initialValues={{
            isActive: true,
            dateExpires: moment().add(7, 'days').format('YYYY-MM-DDTHH:mm'),
          }}
          submitLabel="Save"
          footer={({SubmitButton, disabled}) => (
            <Footer>
              <Flex gap="md" justify="end">
                <Button onClick={closeModal}>Cancel</Button>
                <SubmitButton disabled={disabled}>Save</SubmitButton>
              </Flex>
            </Footer>
          )}
        />
      </Body>
    </Fragment>
  );
}
