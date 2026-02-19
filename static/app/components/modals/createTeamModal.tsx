import {Fragment} from 'react';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {createTeam} from 'sentry/actionCreators/teams';
import CreateTeamForm from 'sentry/components/teams/createTeamForm';
import {t} from 'sentry/locale';
import type {Organization, Team} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';

interface Props extends ModalRenderProps {
  organization: Organization;
  onClose?: (team: Team) => void;
}

function CreateTeamModal({Body, Header, organization, onClose, closeModal}: Props) {
  const api = useApi();

  const handleSubmit: React.ComponentProps<typeof CreateTeamForm>['onSubmit'] = async (
    data,
    onSuccess,
    onError
  ) => {
    try {
      const team: Team = await createTeam(api, data, {orgId: organization.slug});

      closeModal();
      onClose?.(team);
      onSuccess(team);
    } catch (err) {
      onError(err as Team);
    }
  };

  return (
    <Fragment>
      <Header closeButton>
        <h5>{t('Create Team')}</h5>
      </Header>
      <Body>
        <CreateTeamForm organization={organization} onSubmit={handleSubmit} />
      </Body>
    </Fragment>
  );
}

export default CreateTeamModal;
