import {Fragment} from 'react';
import {useMutation} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Heading} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useNavigate} from 'sentry/utils/useNavigate';

type Props = ModalRenderProps & {
  clientID: string | null;
  name: string | null;
};

export function ConfirmClientDeleteModal({Body, Footer, Header, clientID, name}: Props) {
  const navigate = useNavigate();

  const deleteClient = useMutation({
    mutationFn: () =>
      fetchMutation({
        url: getApiUrl('/_admin/instance-level-oauth/$clientId/', {
          path: {clientId: clientID ?? ''},
        }),
        method: 'DELETE',
      }),
    onSuccess: () => {
      addSuccessMessage(`Client "${name}" deleted successfully`);
      navigate('/_admin/instance-level-oauth/');
    },
    onError: () => addErrorMessage('Unable to delete client'),
  });

  return (
    <Fragment>
      <Header closeButton>
        <Heading as="h3">Delete client: {name}</Heading>
      </Header>
      <Body>
        <b>WARNING: THIS ACTION WILL PERMANENTLY DELETE CLIENT WITH ID</b> {clientID}
      </Body>
      <Footer>
        <Button
          size="sm"
          variant="danger"
          disabled={deleteClient.isPending}
          onClick={() => deleteClient.mutate()}
        >
          Permanently and Irreversibly Delete Client
        </Button>
      </Footer>
    </Fragment>
  );
}
