import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {openInviteMembersModal} from 'app/actionCreators/modal';
import {Panel} from 'app/components/panels';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Badge from 'app/components/badge';
import Button from 'app/components/button';
import InlineSvg from 'app/components/inlineSvg';
import ListLink from 'app/components/links/listLink';
import NavTabs from 'app/components/navTabs';
import routeTitleGen from 'app/utils/routeTitle';
import SentryTypes from 'app/sentryTypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import space from 'app/styles/space';

type Props = AsyncView['props'] & {
  children?: any;
};

class OrganizationMembersWrapper extends AsyncView<Props, AsyncView['state']> {
  static contextTypes = {
    router: PropTypes.object,
    organization: SentryTypes.Organization,
  };

  getEndpoints(): ([string, string, any] | [string, string])[] {
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

  get showNavTabs() {
    const {requestList} = this.state;
    const {organization} = this.context;

    return requestList.length > 0
      ? true
      : organization.experiments &&
          (organization.experiments.JoinRequestExperiment === 1 ||
            organization.experiments.InviteRequestExperiment === 1);
  }

  get requestCount() {
    const {requestList, inviteRequests} = this.state;
    const count = requestList.length + inviteRequests.length;
    return count ? count.toString() : null;
  }

  updateRequestList = (id: string) => {
    this.setState(state => ({
      requestList: state.requestList.filter(({id: existingId}) => existingId !== id),
    }));
  };

  updateInviteRequests = (id: string) => {
    this.setState(state => ({
      inviteRequests: state.inviteRequests.filter(
        ({id: existingId}) => existingId !== id
      ),
    }));
  };

  renderBody() {
    const {
      children,
      params: {orgId},
    } = this.props;
    const {requestList, inviteRequests} = this.state;
    const {organization} = this.context;
    const {access} = organization;

    const canAddMembers = access.indexOf('member:write') > -1;

    return (
      <React.Fragment>
        <SettingsPageHeader title="Members" />

        <StyledPanel>
          <InlineSvg src="icon-mail" size="36px" />
          <TextContainer>
            <Heading>{t('Invite new members')}</Heading>
            <SubText>
              {t('Invite new members by email to join your organization.')}
            </SubText>
          </TextContainer>
          <Button
            priority="primary"
            size="small"
            disabled={!canAddMembers}
            title={
              !canAddMembers
                ? t('You do not have enough permission to add new members')
                : undefined
            }
            onClick={openInviteMembersModal}
          >
            {t('Invite Members')}
          </Button>
        </StyledPanel>

        {this.showNavTabs && (
          <NavTabs underlined>
            <ListLink
              to={`/settings/${orgId}/members/`}
              isActive={() => !location.pathname.includes('/requests/')}
              data-test-id="members-tab"
            >
              {t('Members')}
            </ListLink>
            <ListLink
              to={`/settings/${orgId}/members/requests/`}
              isActive={() => location.pathname.includes('/requests/')}
              data-test-id="requests-tab"
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
            updateInviteRequests: this.updateInviteRequests,
            updateRequestList: this.updateRequestList,
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
`;

export default OrganizationMembersWrapper;
