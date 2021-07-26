import * as React from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {Client} from 'app/api';
import Button from 'app/components/button';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {t, tct} from 'app/locale';
import space from 'app/styles/space';
import {AccessRequest} from 'app/types';
import withApi from 'app/utils/withApi';

type Props = {
  api: Client;
  orgId: string;
  onRemoveAccessRequest: (id: string, isApproved: boolean) => void;
  requestList: AccessRequest[];
};

type State = {
  accessRequestBusy: Record<string, boolean>;
};

type HandleOpts = {
  id: string;
  isApproved: boolean;
  successMessage: string;
  errorMessage: string;
};

class OrganizationAccessRequests extends React.Component<Props, State> {
  state: State = {
    accessRequestBusy: {},
  };

  async handleAction({id, isApproved, successMessage, errorMessage}: HandleOpts) {
    const {api, orgId, onRemoveAccessRequest} = this.props;

    this.setState(state => ({
      accessRequestBusy: {...state.accessRequestBusy, [id]: true},
    }));

    try {
      await api.requestPromise(`/organizations/${orgId}/access-requests/${id}/`, {
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
                    size="small"
                    onClick={e => this.handleApprove(id, e)}
                    busy={accessRequestBusy[id]}
                  >
                    {t('Approve')}
                  </StyledButton>
                  <Button
                    busy={accessRequestBusy[id]}
                    onClick={e => this.handleDeny(id, e)}
                    size="small"
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
  grid-gap: ${space(2)};
  align-items: center;
`;

const StyledButton = styled(Button)`
  margin-right: ${space(1)};
`;

export default withApi(OrganizationAccessRequests);
