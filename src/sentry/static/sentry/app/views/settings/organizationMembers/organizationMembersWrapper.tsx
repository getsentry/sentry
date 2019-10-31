import React from 'react';
import styled from 'react-emotion';

import {openInviteMembersModal} from 'app/actionCreators/modal';
import {OrganizationDetailed} from 'app/types';
import {Panel} from 'app/components/panels';
import {t} from 'app/locale';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import AsyncView from 'app/views/asyncView';
import Badge from 'app/components/badge';
import Button from 'app/components/button';
import InlineSvg from 'app/components/inlineSvg';
import ListLink from 'app/components/links/listLink';
import NavTabs from 'app/components/navTabs';
import routeTitleGen from 'app/utils/routeTitle';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import space from 'app/styles/space';
import withOrganization from 'app/utils/withOrganization';

type Props = AsyncView['props'] & {
  children?: any;
  organization: OrganizationDetailed;
};

class OrganizationMembersWrapper extends AsyncView<Props> {
  componentDidMount() {
    const {organization} = this.props;

    // record when requests tab is viewed on members page
    if (this.showInviteRequests && !this.onRequestsTab) {
      trackAnalyticsEvent({
        eventKey: 'invite_request.tab_viewed',
        eventName: 'Invite Request Tab Viewed',
        organization_id: organization.id,
      });
    }
  }

  getEndpoints(): [string, string][] {
    const {orgId} = this.props.params;

    return [
      ['inviteRequests', `/organizations/${orgId}/invite-requests/`],
      ['requestList', `/organizations/${orgId}/access-requests/`],
    ];
  }

  getTitle() {
    const {orgId} = this.props.params;
    return routeTitleGen(t('Members'), orgId, false);
  }

  get hasExperiment() {
    const {organization} = this.props;

    return (
      !!organization &&
      !!organization.experiments &&
      organization.experiments.ImprovedInvitesExperiment !== undefined &&
      organization.experiments.ImprovedInvitesExperiment !== 'none'
    );
  }

  get hasInviteRequestExperiment() {
    const {organization} = this.props;

    if (!organization || !organization.experiments) {
      return false;
    }

    const variant = organization.experiments.ImprovedInvitesExperiment;

    return variant === 'all' || variant === 'invite_request';
  }

  get onRequestsTab() {
    return location.pathname.includes('/requests/');
  }

  get hasWriteAccess() {
    const {organization} = this.props;
    if (!organization || !organization.access) {
      return false;
    }
    return organization.access.includes('member:write');
  }

  get canOpeninviteModal() {
    return this.hasWriteAccess || this.hasInviteRequestExperiment;
  }

  get showInviteRequests() {
    return this.hasWriteAccess && this.hasExperiment;
  }

  get showNavTabs() {
    const {requestList} = this.state;

    // show the requests tab if there are pending team requests,
    // or if the organization is exposed to the experiment and
    // the user has access to approve or deny requests
    return (requestList && requestList.length > 0) || this.showInviteRequests;
  }

  get requestCount() {
    const {requestList, inviteRequests} = this.state;
    let count = requestList.length;

    // if the user can't see the invite requests panel,
    // exclude those requests from the total count
    if (this.showInviteRequests) {
      count += inviteRequests.length;
    }
    return count ? count.toString() : null;
  }

  updateRequestList = (id: string) =>
    this.setState(state => ({
      requestList: state.requestList.filter(({id: existingId}) => existingId !== id),
    }));

  updateInviteRequests = (id: string) =>
    this.setState(state => ({
      inviteRequests: state.inviteRequests.filter(
        ({id: existingId}) => existingId !== id
      ),
    }));

  renderBody() {
    const {
      children,
      organization,
      params: {orgId},
    } = this.props;
    const {requestList, inviteRequests} = this.state;

    return (
      <React.Fragment>
        <SettingsPageHeader title="Members" />

        <StyledPanel>
          <InlineSvg src="icon-mail" size="36px" />
          <TextContainer>
            <Heading>{t('Invite new members')}</Heading>
            <SubText>
              {t('Invite new members by email to join your organization')}
            </SubText>
          </TextContainer>
          <Button
            priority="primary"
            size="small"
            onClick={() => openInviteMembersModal({source: 'members_settings'})}
            disabled={!this.canOpeninviteModal}
            title={
              !this.canOpeninviteModal
                ? t('You do not have enough permission to add new members')
                : undefined
            }
          >
            {t('Invite Members')}
          </Button>
        </StyledPanel>

        {this.showNavTabs && (
          <NavTabs underlined>
            <ListLink
              to={`/settings/${orgId}/members/`}
              isActive={() => !this.onRequestsTab}
              data-test-id="members-tab"
            >
              {t('Members')}
            </ListLink>
            <ListLink
              to={`/settings/${orgId}/members/requests/`}
              isActive={() => this.onRequestsTab}
              data-test-id="requests-tab"
              onClick={() => {
                this.showInviteRequests &&
                  trackAnalyticsEvent({
                    eventKey: 'invite_request.tab_clicked',
                    eventName: 'Invite Request Tab Clicked',
                    organization_id: organization.id,
                  });
              }}
            >
              {t('Requests')}
            </ListLink>
            {this.requestCount && <StyledBadge text={this.requestCount} />}
          </NavTabs>
        )}

        {children &&
          React.cloneElement(children, {
            requestList,
            inviteRequests,
            onUpdateInviteRequests: this.updateInviteRequests,
            onUpdateRequestList: this.updateRequestList,
            showInviteRequests: this.showInviteRequests,
          })}
      </React.Fragment>
    );
  }
}

const StyledPanel = styled(Panel)`
  padding: 18px;
  margin-top: -14px;
  margin-bottom: 40px;
  display: grid;
  grid-template-columns: max-content auto max-content;
  grid-gap: ${space(3)};
  align-items: center;
  align-content: center;
`;

const TextContainer = styled('div')`
  display: inline-grid;
  grid-gap: ${space(1)};
`;

const Heading = styled('h1')`
  margin: 0;
  font-weight: 400;
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const SubText = styled('p')`
  margin: 0;
  color: ${p => p.theme.gray3};
  font-size: 15px;
`;

const StyledBadge = styled(Badge)`
  margin-left: -12px;

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    margin-left: -6px;
  }
`;

export default withOrganization(OrganizationMembersWrapper);
