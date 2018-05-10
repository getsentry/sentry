import {withRouter} from 'react-router';
import React from 'react';
import PropTypes from 'prop-types';
import {Flex, Box} from 'grid-emotion';

import {t, tct} from 'app/locale';
import AsyncComponent from 'app/components/asyncComponent';
import Button from 'app/components/buttons/button';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import SentryTypes from 'app/proptypes';

class OrganizationAccessRequests extends React.Component {
  static propTypes = {
    requestList: PropTypes.arrayOf(
      PropTypes.shape({
        id: PropTypes.string.isRequired,
        member: SentryTypes.Member,
        team: SentryTypes.Team,
      })
    ),
    accessRequestBusy: PropTypes.object,
    onApprove: PropTypes.func.isRequired,
    onDeny: PropTypes.func.isRequired,
  };

  static defaultProps = {
    requestList: [],
  };

  handleApprove = (id, e) => {
    e.stopPropagation();
    this.props.onApprove(id);
  };

  handleDeny = (id, e) => {
    e.stopPropagation();
    this.props.onDeny(id);
  };

  render() {
    let {accessRequestBusy, requestList} = this.props;

    if (!requestList || !requestList.length) return null;

    return (
      <Panel>
        <PanelHeader disablePadding>
          <Flex>
            <Box px={2} flex="1">
              {t('Pending Access Requests')}
            </Box>
          </Flex>
        </PanelHeader>

        <PanelBody>
          {requestList.map(({id, member, team}, i) => {
            let displayName =
              member.user &&
              (member.user.name || member.user.email || member.user.username);
            return (
              <PanelItem p={0} key={id} align="center">
                <Box p={2} flex="1">
                  {tct('[name] requests access to the [team] team.', {
                    name: <strong>{displayName}</strong>,
                    team: <strong>#{team.slug}</strong>,
                  })}
                </Box>
                <Box p={2}>
                  <Button
                    onClick={e => this.handleApprove(id, e)}
                    busy={accessRequestBusy.get(id)}
                    priority="primary"
                    style={{marginRight: 4}}
                    size="small"
                  >
                    {t('Approve')}
                  </Button>
                  <Button
                    busy={accessRequestBusy.get(id)}
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

class OrganizationAccessRequestsContainer extends AsyncComponent {
  static propTypes = {
    routes: PropTypes.array,
    router: PropTypes.object.isRequired,
    organization: SentryTypes.Organization,
  };

  getDefaultState() {
    let state = super.getDefaultState();
    return {
      ...state,
      accessRequestBusy: new Map(),
    };
  }

  getEndpoints() {
    return [
      ['requestList', `/organizations/${this.props.params.orgId}/access-requests/`],
    ];
  }

  approveOrDeny = (isApproved, id) => {
    let {params} = this.props;
    let {orgId} = params || {};

    this.setState(state => ({
      accessRequestBusy: state.accessRequestBusy.set(id, true),
    }));

    return new Promise((resolve, reject) => {
      this.api.request(`/organizations/${orgId}/access-requests/${id}/`, {
        method: 'PUT',
        data: {isApproved},
        success: data => {
          this.setState(state => ({
            requestList: state.requestList.filter(
              ({id: existingId}) => existingId !== id
            ),
          }));
          resolve(data);
        },
        error: err => reject(err),
        complete: () =>
          this.setState(state => ({
            accessRequestBusy: state.accessRequestBusy.set(id, false),
          })),
      });
    });
  };

  handleApprove = id => this.approveOrDeny(true, id);

  handleDeny = id => this.approveOrDeny(false, id);

  renderBody() {
    let {requestList, accessRequestBusy} = this.state;

    return (
      <OrganizationAccessRequests
        onApprove={this.handleApprove}
        onDeny={this.handleDeny}
        accessRequestBusy={accessRequestBusy}
        requestList={requestList}
        {...this.props}
      />
    );
  }
}

export default withRouter(OrganizationAccessRequestsContainer);
