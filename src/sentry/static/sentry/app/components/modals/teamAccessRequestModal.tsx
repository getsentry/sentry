import { Component, Fragment } from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import {ModalRenderProps, TeamAccessRequestModalOptions} from 'app/actionCreators/modal';
import {t, tct} from 'app/locale';
import Button from 'app/components/button';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';

type Props = ModalRenderProps &
  TeamAccessRequestModalOptions & {
    api: Client;
    memberId: string;
    teamId: string;
    orgId: string;
  };

type State = {
  createBusy: boolean;
};

class CreateTeamAccessRequest extends Component<Props, State> {
  state: State = {
    createBusy: false,
  };

  handleClick = async () => {
    const {api, memberId, orgId, teamId, closeModal} = this.props;

    this.setState({createBusy: true});

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
    this.setState({createBusy: false});
    closeModal();
  };

  render() {
    const {Body, Footer, closeModal, teamId} = this.props;

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
            <Button
              priority="primary"
              onClick={this.handleClick}
              busy={this.state.createBusy}
              autoFocus
            >
              {t('Continue')}
            </Button>
          </ButtonGroup>
        </Footer>
      </Fragment>
    );
  }
}

const ButtonGroup = styled('div')`
  display: grid;
  grid-template-columns: max-content max-content;
  grid-gap: ${space(1)};
`;

export default withApi(CreateTeamAccessRequest);
