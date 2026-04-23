import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useApi} from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';

type Props = ModalRenderProps & {
  clientID: string | null;
  name: string | null;
};

export function ConfirmClientDeleteModal({Body, Header, clientID, name}: Props) {
  const api = useApi();
  const navigate = useNavigate();

  const deleteClientAndCloseModal = async () => {
    try {
      await api.requestPromise(`/_admin/instance-level-oauth/${clientID}/`, {
        method: 'DELETE',
      });
      addSuccessMessage(`Client "${name}" deleted successfully`);
      navigate('/_admin/instance-level-oauth/');
    } catch (err) {
      const message = 'Unable to load client data';
      handleXhrErrorResponse(message, err as RequestError);
      addErrorMessage(message);
    }
  };

  return (
    <Fragment>
      <Header closeButton>Delete client: {name}</Header>
      <Body>
        <b>WARNING: THIS ACTION WILL PERMANENTLY DELETE CLIENT WITH ID</b> {clientID}
      </Body>
      <StyledButton size="sm" priority="danger" onClick={deleteClientAndCloseModal}>
        Permanently and Irreversibly Delete Client
      </StyledButton>
    </Fragment>
  );
}

const StyledButton = styled(Button)`
  margin-top: 10px;
`;
