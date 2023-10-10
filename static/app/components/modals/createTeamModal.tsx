import {Fragment} from 'react';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import {createTeam} from 'sentry/actionCreators/teams';
import CreateTeamForm from 'sentry/components/teams/createTeamForm';
import {t} from 'sentry/locale';
import {Organization, Team} from 'sentry/types';
import useApi from 'sentry/utils/useApi';

interface Props extends ModalRenderProps {
  organization: Organization;
  onClose?: (team: Team) => void;
}

function CreateTeamModal({Body, Header, ...props}: Props) {
  const {onClose, closeModal, organization} = props;
  const api = useApi();

  async function handleSubmit(
    data: {slug: string},
    onSuccess: Function,
    onError: Function
  ) {
    try {
      const team: Team = await createTeam(api, data, {orgId: organization.slug});

      closeModal();
      onClose?.(team);
      onSuccess(team);
    } catch (err) {
      onError(err);
    }
  }

  return (
    <Fragment>
      <Header closeButton>{t('Create Team')}</Header>
      <Body>
        <CreateTeamForm {...props} onSubmit={handleSubmit} />
      </Body>
    </Fragment>
  );
}

export default CreateTeamModal;
