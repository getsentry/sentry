import React from 'react';
import PropTypes from 'prop-types';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {t, tct} from 'app/locale';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import Button from 'app/components/button';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import styled from 'react-emotion';
import withApi from 'app/utils/withApi';

class OrganizationAccessRequests extends React.Component {
  static propTypes = {
    api: PropTypes.object.isRequired,
    orgId: PropTypes.string.isRequired,
    onUpdateRequestList: PropTypes.func.isRequired,
    requestList: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        member: SentryTypes.Member,
        team: SentryTypes.Team,
      })
    ),
  };

  static defaultProps = {
    requestList: [],
  };

  state = {
    accessRequestBusy: {},
  };

  handleAction = async ({id, isApproved, successMessage, errorMessage}) => {
    const {api, orgId, onUpdateRequestList} = this.props;

    this.setState(state => ({
      accessRequestBusy: {...state.accessRequestBusy, [id]: true},
    }));

    try {
      await api.requestPromise(`/organizations/${orgId}/access-requests/${id}/`, {
        method: 'PUT',
        data: {isApproved},
      });
      onUpdateRequestList(id);
      addSuccessMessage(successMessage);
    } catch {
      addErrorMessage(errorMessage);
    }

    this.setState(state => ({
      accessRequestBusy: {...state.accessRequestBusy, [id]: false},
    }));
  };

  handleApprove = (id, e) => {
    e.stopPropagation();
    this.handleAction({
      id,
      isApproved: true,
      successMessage: t('Team request approved'),
      errorMessage: t('Error approving team request'),
    });
  };

  handleDeny = (id, e) => {
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
          {requestList.map(({id, member, team}) => {
            const displayName =
              member.user &&
              (member.user.name || member.user.email || member.user.username);
            return (
              <StyledPanelItem key={id}>
                <div data-test-id="request-message">
                  {tct('[name] requests access to the [team] team.', {
                    name: <strong>{displayName}</strong>,
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
