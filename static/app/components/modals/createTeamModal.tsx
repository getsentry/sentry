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

function CreateTeamModal({Body, Header, ...props}: Props) {
  const {onClose, closeModal, organization} = props;
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
      onError(err);
    }
  };

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
