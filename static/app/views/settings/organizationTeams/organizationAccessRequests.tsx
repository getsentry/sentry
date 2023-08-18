import {Component} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Client} from 'sentry/api';
import {Button} from 'sentry/components/button';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {AccessRequest} from 'sentry/types';
import withApi from 'sentry/utils/withApi';

type Props = {
  api: Client;
  onRemoveAccessRequest: (id: string, isApproved: boolean) => void;
  orgSlug: string;
  requestList: AccessRequest[];
};

type State = {
  accessRequestBusy: Record<string, boolean>;
};

type HandleOpts = {
  errorMessage: string;
  id: string;
  isApproved: boolean;
  successMessage: string;
};

class OrganizationAccessRequests extends Component<Props, State> {
  state: State = {
    accessRequestBusy: {},
  };

  async handleAction({id, isApproved, successMessage, errorMessage}: HandleOpts) {
    const {api, orgSlug, onRemoveAccessRequest} = this.props;

    this.setState(state => ({
      accessRequestBusy: {...state.accessRequestBusy, [id]: true},
    }));

    try {
      await api.requestPromise(`/organizations/${orgSlug}/access-requests/${id}/`, {
        method: 'PUT',
        data: {isApproved},
      });
      onRemoveAccessRequest(id, isApproved);
      addSuccessMessage(successMessage);
    } catch {
      addErrorMessage(errorMessage);
    }

    this.setState(state => ({
      accessRequestBusy: {...state.accessRequestBusy, [id]: false},
    }));
  }

  handleApprove = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    this.handleAction({
      id,
      isApproved: true,
      successMessage: t('Team request approved'),
      errorMessage: t('Error approving team request'),
    });
  };

  handleDeny = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    this.handleAction({
      id,
      isApproved: false,
      successMessage: t('Team request denied'),
      errorMessage: t('Error denying team request'),
    });
  };

  render() {
    const {requestList} = this.props;
    const {accessRequestBusy} = this.state;

    if (!requestList || !requestList.length) {
      return null;
    }

    return (
      <Panel>
        <PanelHeader>{t('Pending Team Requests')}</PanelHeader>

        <PanelBody>
          {requestList.map(({id, member, team, requester}) => {
            const memberName =
              member.user &&
              (member.user.name || member.user.email || member.user.username);
            const requesterName =
              requester && (requester.name || requester.email || requester.username);
            return (
              <StyledPanelItem key={id}>
                <div data-test-id="request-message">
                  {requesterName
                    ? tct('[requesterName] requests to add [name] to the [team] team.', {
                        requesterName,
                        name: <strong>{memberName}</strong>,
                        team: <strong>#{team.slug}</strong>,
                      })
                    : tct('[name] requests access to the [team] team.', {
                        name: <strong>{memberName}</strong>,
                        team: <strong>#{team.slug}</strong>,
                      })}
                </div>
                <div>
                  <StyledButton
                    priority="primary"
                    size="sm"
                    onClick={e => this.handleApprove(id, e)}
                    busy={accessRequestBusy[id]}
                  >
                    {t('Approve')}
                  </StyledButton>
                  <Button
                    busy={accessRequestBusy[id]}
                    onClick={e => this.handleDeny(id, e)}
                    size="sm"
                  >
                    {t('Deny')}
                  </Button>
                </div>
              </StyledPanelItem>
            );
          })}
        </PanelBody>
      </Panel>
    );
  }
}

const StyledPanelItem = styled(PanelItem)`
  display: grid;
  grid-template-columns: auto max-content;
  gap: ${space(2)};
  align-items: center;
`;

const StyledButton = styled(Button)`
  margin-right: ${space(1)};
`;

export default withApi(OrganizationAccessRequests);
