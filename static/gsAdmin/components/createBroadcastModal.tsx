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
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useNavigate} from 'sentry/utils/useNavigate';

import {broadcastValidationSchema} from 'admin/schemas/broadcasts';

interface CreateBroadcastModal extends ModalRenderProps {
  fields: JsonFormAdapterFieldConfig[];
}

type CreateBroadcastPayload = Pick<Broadcast, 'title' | 'message' | 'link'> & {
  category?: string;
  mediaUrl?: string;
  organizations?: number[];
  region?: string;
};

export function CreateBroadcastModal({
  Header,
  Body,
  Footer,
  closeModal,
  fields,
}: CreateBroadcastModal) {
  const navigate = useNavigate();
  const updateBroadcast = useMutation({
    mutationFn: (data: CreateBroadcastPayload) => {
      return fetchMutation<Broadcast>({
        url: getApiUrl('/broadcasts/'),
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
    const title = typeof data.title === 'string' ? data.title : '';
    const message = typeof data.message === 'string' ? data.message : '';
    const link = typeof data.link === 'string' ? data.link : '';
    const mediaUrl = typeof data.mediaUrl === 'string' ? data.mediaUrl : '';
    const newData: CreateBroadcastPayload = {
      ...data,
      title,
      message,
      link,
      category:
        typeof data.category === 'string' ? data.category || undefined : undefined,
      mediaUrl: mediaUrl || undefined,
      region: typeof data.region === 'string' ? data.region || undefined : undefined,
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
          validationSchema={broadcastValidationSchema}
          initialValues={{
            isActive: true,
            dateExpires: moment().add(7, 'days').format('YYYY-MM-DDTHH:mm'),
          }}
          footer={({SubmitButton}) => (
            <Footer>
              <Flex gap="md" justify="end">
                <Button onClick={closeModal}>Cancel</Button>
                <SubmitButton>Save</SubmitButton>
              </Flex>
            </Footer>
          )}
        />
      </Body>
    </Fragment>
  );
}
