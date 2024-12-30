import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {
  ModalRenderProps,
  TeamAccessRequestModalOptions,
} from 'sentry/actionCreators/modal';
import type {Client} from 'sentry/api';
import {Button} from 'sentry/components/button';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import withApi from 'sentry/utils/withApi';

export interface CreateTeamAccessRequestModalProps
  extends ModalRenderProps,
    TeamAccessRequestModalOptions {
  api: Client;
  memberId: string;
  orgId: string;
  teamId: string;
}

function CreateTeamAccessRequestModal(props: CreateTeamAccessRequestModalProps) {
  const [createBusy, setCreateBusy] = useState<boolean>(false);
  const {api, memberId, orgId, teamId, closeModal, Body, Footer} = props;

  const handleClick = async () => {
    setCreateBusy(true);

    try {
      await api.requestPromise(
        `/organizations/${orgId}/members/${memberId}/teams/${teamId}/`,
        {
          method: 'POST',
        }
      );
      addSuccessMessage(t('Team request sent for approval'));
    } catch (err) {
      addErrorMessage(t('Unable to send team request'));
    }
    setCreateBusy(false);
    closeModal();
  };

  return (
    <Fragment>
      <Body>
        {tct(
          'You do not have permission to add members to the #[team] team, but we will send a request to your organization admins for approval.',
          {team: teamId}
        )}
      </Body>
      <Footer>
        <ButtonGroup>
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button priority="primary" onClick={handleClick} busy={createBusy} autoFocus>
            {t('Continue')}
          </Button>
        </ButtonGroup>
      </Footer>
    </Fragment>
  );
}

const ButtonGroup = styled('div')`
  display: grid;
  grid-template-columns: max-content max-content;
  gap: ${space(1)};
`;

export default withApi(CreateTeamAccessRequestModal);
