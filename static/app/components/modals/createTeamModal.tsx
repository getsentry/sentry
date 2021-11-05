import {Fragment} from 'react';

import {ModalRenderProps} from 'app/actionCreators/modal';
import {createTeam} from 'app/actionCreators/teams';
import CreateTeamForm from 'app/components/teams/createTeamForm';
import {t} from 'app/locale';
import {Organization, Team} from 'app/types';
import useApi from 'app/utils/useApi';

type Props = ModalRenderProps & {
  organization: Organization;
  onClose?: (team: Team) => void;
};

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
