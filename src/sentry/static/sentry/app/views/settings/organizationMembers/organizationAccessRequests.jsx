import React from 'react';
import PropTypes from 'prop-types';
import {Flex, Box} from 'grid-emotion';

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

  approveOrDeny = async (isApproved, id) => {
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
      addSuccessMessage(
        tct('Team request [action]', {action: isApproved ? 'approved' : 'denied'})
      );
    } catch (err) {
      addErrorMessage(
        tct('Error [action] team request', {
          action: isApproved ? 'approving' : 'denying',
        })
      );
      throw err;
    }

    this.setState(state => ({
      accessRequestBusy: {...state.accessRequestBusy, [id]: false},
    }));
  };

  handleApprove = (id, e) => {
    e.stopPropagation();
    this.approveOrDeny(true, id);
  };

  handleDeny = (id, e) => {
    e.stopPropagation();
    this.approveOrDeny(false, id);
  };

  render() {
    const {requestList} = this.props;
    const {accessRequestBusy} = this.state;

    if (!requestList || !requestList.length) {
      return null;
    }

    return (
      <Panel>
        <PanelHeader disablePadding>
          <Flex>
            <Box px={2} flex="1">
              {t('Pending Team Requests')}
            </Box>
          </Flex>
        </PanelHeader>

        <PanelBody>
          {requestList.map(({id, member, team}) => {
            const displayName =
              member.user &&
              (member.user.name || member.user.email || member.user.username);
            return (
              <PanelItem p={0} key={id} align="center">
                <Box p={2} flex="1" data-test-id="request-message">
                  {tct('[name] requests access to the [team] team.', {
                    name: <strong>{displayName}</strong>,
                    team: <strong>#{team.slug}</strong>,
                  })}
                </Box>
                <Box p={2}>
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
                </Box>
              </PanelItem>
            );
          })}
        </PanelBody>
      </Panel>
    );
  }
}

const StyledButton = styled(Button)`
  margin-right: ${space(1)};
`;

export default withApi(OrganizationAccessRequests);
