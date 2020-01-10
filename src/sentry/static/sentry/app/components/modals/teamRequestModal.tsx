import React from 'react';
import styled from 'react-emotion';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import {ModalRenderProps, TeamRequestModalOptions} from 'app/actionCreators/modal';
import {t} from 'app/locale';
import Button from 'app/components/button';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';

type Props = ModalRenderProps &
  TeamRequestModalOptions & {
    api: Client;
    memberId: string;
    teamId: string;
    orgId: string;
  };

type State = {
  createBusy: boolean;
};

class CreateTeamRequest extends React.Component<Props, State> {
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
      this.setState({createBusy: false});
      addSuccessMessage(t('Team request sent for approval'));
    } catch (err) {
      this.setState({createBusy: false});
      addErrorMessage(t('Unable to send team request.'));
    }
    closeModal();
  };

  render() {
    const {Body, Footer, closeModal} = this.props;

    return (
      <React.Fragment>
        <Body>
          {t(
            'You do not have permission to add members to teams, but we will send a request to your organization admins for approval.'
          )}
        </Body>
        <Footer>
          <ButtonGroup>
            <Button onClick={closeModal} autoFocus>
              {t('Cancel')}
            </Button>
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
      </React.Fragment>
    );
  }
}

const ButtonGroup = styled('div')`
  display: grid;
  grid-template-columns: max-content max-content;
  grid-gap: ${space(1)};
`;

export default withApi(CreateTeamRequest);
