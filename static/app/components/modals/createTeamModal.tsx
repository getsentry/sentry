import {Component, Fragment} from 'react';

import {ModalRenderProps} from 'app/actionCreators/modal';
import {createTeam} from 'app/actionCreators/teams';
import {Client} from 'app/api';
import CreateTeamForm from 'app/components/teams/createTeamForm';
import {t} from 'app/locale';
import {Organization, Team} from 'app/types';
import withApi from 'app/utils/withApi';

type Props = {
  api: Client;
  organization: Organization;
  onClose?: (team: Team) => void;
} & ModalRenderProps;

class CreateTeamModal extends Component<Props> {
  handleSubmit = (data: {slug: string}, onSuccess: Function, onError: Function) => {
    const {organization, api} = this.props;
    createTeam(api, data, {orgId: organization.slug})
      .then((resp: Team) => {
        this.handleSuccess(resp);
        onSuccess(resp);
      })
      .catch((err: Error) => {
        onError(err);
      });
  };

  handleSuccess(team: Team) {
    if (this.props.onClose) {
      this.props.onClose(team);
    }

    this.props.closeModal();
  }

  render() {
    const {Body, Header, ...props} = this.props;

    return (
      <Fragment>
        <Header closeButton>{t('Create Team')}</Header>
        <Body>
          <CreateTeamForm {...props} onSubmit={this.handleSubmit} />
        </Body>
      </Fragment>
    );
  }
}

export default withApi(CreateTeamModal);
