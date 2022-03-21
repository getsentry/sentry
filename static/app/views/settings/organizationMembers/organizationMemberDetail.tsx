import {Fragment} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';

import {removeAuthenticator} from 'sentry/actionCreators/account';
import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {resendMemberInvite, updateMember} from 'sentry/actionCreators/members';
import AutoSelectText from 'sentry/components/autoSelectText';
import Button from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import DateTime from 'sentry/components/dateTime';
import NotFound from 'sentry/components/errors/notFound';
import Field from 'sentry/components/forms/field';
import HookOrDefault from 'sentry/components/hookOrDefault';
import ExternalLink from 'sentry/components/links/externalLink';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'sentry/components/panels';
import Tooltip from 'sentry/components/tooltip';
import {t, tct} from 'sentry/locale';
import {inputStyles} from 'sentry/styles/input';
import space from 'sentry/styles/space';
import {Member, Organization, Team} from 'sentry/types';
import isMemberDisabledFromLimit from 'sentry/utils/isMemberDisabledFromLimit';
import recreateRoute from 'sentry/utils/recreateRoute';
import Teams from 'sentry/utils/teams';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import TeamSelect from 'sentry/views/settings/components/teamSelect';

import RoleSelect from './inviteMember/roleSelect';

const MULTIPLE_ORGS = t('Cannot be reset since user is in more than one organization');
const NOT_ENROLLED = t('Not enrolled in two-factor authentication');
const NO_PERMISSION = t('You do not have permission to perform this action');
const TWO_FACTOR_REQUIRED = t(
  'Cannot be reset since two-factor is required for this organization'
);

type RouteParams = {
  memberId: string;
  orgId: string;
};

type Props = {
  organization: Organization;
} & RouteComponentProps<RouteParams, {}>;

type State = {
  member: Member | null;
  roleList: Member['roles'];
  selectedRole: Member['role'];
} & AsyncView['state'];

const DisabledMemberTooltip = HookOrDefault({
  hookName: 'component:disabled-member-tooltip',
  defaultComponent: ({children}) => <Fragment>{children}</Fragment>,
});

class OrganizationMemberDetail extends AsyncView<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      roleList: [],
      selectedRole: '',
      member: null,
    };
  }

  getEndpoints(): ReturnType<AsyncView['getEndpoints']> {
    const {organization, params} = this.props;
    return [
      ['member', `/organizations/${organization.slug}/members/${params.memberId}/`],
    ];
  }

  redirectToMemberPage() {
    const {location, params, routes} = this.props;
    const members = recreateRoute('members/', {
      location,
      routes,
      params,
      stepBack: -2,
    });
    browserHistory.push(members);
  }

  handleSave = async () => {
    const {organization, params} = this.props;

    addLoadingMessage(t('Saving...'));
    this.setState({busy: true});

    try {
      await updateMember(this.api, {
        orgId: organization.slug,
        memberId: params.memberId,
        data: this.state.member,
      });
      addSuccessMessage(t('Saved'));
      this.redirectToMemberPage();
    } catch (resp) {
      const errorMessage =
        (resp && resp.responseJSON && resp.responseJSON.detail) || t('Could not save...');
      addErrorMessage(errorMessage);
    }
    this.setState({busy: false});
  };

  handleInvite = async (regenerate: boolean) => {
    const {organization, params} = this.props;

    addLoadingMessage(t('Sending invite...'));

    this.setState({busy: true});

    try {
      const data = await resendMemberInvite(this.api, {
        orgId: organization.slug,
        memberId: params.memberId,
        regenerate,
      });

      addSuccessMessage(t('Sent invite!'));

      if (regenerate) {
        this.setState(state => ({member: {...state.member, ...data}}));
      }
    } catch (_err) {
      addErrorMessage(t('Could not send invite'));
    }

    this.setState({busy: false});
  };

  handleAddTeam = (team: Team) => {
    const {member} = this.state;
    if (!member!.teams.includes(team.slug)) {
      member!.teams.push(team.slug);
    }
    this.setState({member});
  };

  handleRemoveTeam = (removedTeam: string) => {
    const {member} = this.state;

    this.setState({
      member: {
        ...member!,
        teams: member!.teams.filter(slug => slug !== removedTeam),
      },
    });
  };

  handle2faReset = async () => {
    const {organization, router} = this.props;
    const {user} = this.state.member!;

    const requests = user.authenticators.map(auth =>
      removeAuthenticator(this.api, user.id, auth.id)
    );

    try {
      await Promise.all(requests);
      router.push(`/settings/${organization.slug}/members/`);
      addSuccessMessage(t('All authenticators have been removed'));
    } catch (err) {
      addErrorMessage(t('Error removing authenticators'));
      Sentry.captureException(err);
    }
  };

  showResetButton = () => {
    const {organization} = this.props;
    const {member} = this.state;
    const {user} = member!;

    if (!user || !user.authenticators || organization.require2FA) {
      return false;
    }
    const hasAuth = user.authenticators.length >= 1;
    return hasAuth && user.canReset2fa;
  };

  getTooltip = (): string => {
    const {organization} = this.props;
    const {member} = this.state;
    const {user} = member!;

    if (!user) {
      return '';
    }

    if (!user.authenticators) {
      return NO_PERMISSION;
    }
    if (!user.authenticators.length) {
      return NOT_ENROLLED;
    }
    if (!user.canReset2fa) {
      return MULTIPLE_ORGS;
    }
    if (organization.require2FA) {
      return TWO_FACTOR_REQUIRED;
    }

    return '';
  };

  get memberDeactivated() {
    return isMemberDisabledFromLimit(this.state.member);
  }

  renderMemberStatus(member: Member) {
    if (this.memberDeactivated) {
      return (
        <em>
          <DisabledMemberTooltip>{t('Deactivated')}</DisabledMemberTooltip>
        </em>
      );
    }
    if (member.expired) {
      return <em>{t('Invitation Expired')}</em>;
    }
    if (member.pending) {
      return <em>{t('Invitation Pending')}</em>;
    }
    return t('Active');
  }

  renderBody() {
    const {organization} = this.props;
    const {member} = this.state;

    if (!member) {
      return <NotFound />;
    }

    const {access} = organization;
    const inviteLink = member.invite_link;
    const canEdit = access.includes('org:write') && !this.memberDeactivated;

    const {email, expired, pending} = member;
    const canResend = !expired;
    const showAuth = !pending;

    return (
      <Fragment>
        <SettingsPageHeader
          title={
            <Fragment>
              <div>{member.name}</div>
              <ExtraHeaderText>{t('Member Settings')}</ExtraHeaderText>
            </Fragment>
          }
        />

        <Panel>
          <PanelHeader>{t('Basics')}</PanelHeader>

          <PanelBody>
            <PanelItem>
              <OverflowWrapper>
                <Details>
                  <div>
                    <DetailLabel>{t('Email')}</DetailLabel>
                    <div>
                      <ExternalLink href={`mailto:${email}`}>{email}</ExternalLink>
                    </div>
                  </div>
                  <div>
                    <DetailLabel>{t('Status')}</DetailLabel>
                    <div data-test-id="member-status">
                      {this.renderMemberStatus(member)}
                    </div>
                  </div>
                  <div>
                    <DetailLabel>{t('Added')}</DetailLabel>
                    <div>
                      <DateTime dateOnly date={member.dateCreated} />
                    </div>
                  </div>
                </Details>

                {inviteLink && (
                  <InviteSection>
                    <div>
                      <DetailLabel>{t('Invite Link')}</DetailLabel>
                      <AutoSelectText>
                        <CodeInput>{inviteLink}</CodeInput>
                      </AutoSelectText>
                      <p className="help-block">
                        {t('This unique invite link may only be used by this member.')}
                      </p>
                    </div>
                    <InviteActions>
                      <Button onClick={() => this.handleInvite(true)}>
                        {t('Generate New Invite')}
                      </Button>
                      {canResend && (
                        <Button
                          data-test-id="resend-invite"
                          onClick={() => this.handleInvite(false)}
                        >
                          {t('Resend Invite')}
                        </Button>
                      )}
                    </InviteActions>
                  </InviteSection>
                )}
              </OverflowWrapper>
            </PanelItem>
          </PanelBody>
        </Panel>

        {showAuth && (
          <Panel>
            <PanelHeader>{t('Authentication')}</PanelHeader>
            <PanelBody>
              <Field
                alignRight
                flexibleControlStateSize
                label={t('Reset two-factor authentication')}
                help={t(
                  'Resetting two-factor authentication will remove all two-factor authentication methods for this member.'
                )}
              >
                <Tooltip
                  data-test-id="reset-2fa-tooltip"
                  disabled={this.showResetButton()}
                  title={this.getTooltip()}
                >
                  <Confirm
                    disabled={!this.showResetButton()}
                    message={tct(
                      'Are you sure you want to disable all two-factor authentication methods for [name]?',
                      {name: member.name ? member.name : 'this member'}
                    )}
                    onConfirm={this.handle2faReset}
                    data-test-id="reset-2fa-confirm"
                  >
                    <Button data-test-id="reset-2fa" priority="danger">
                      {t('Reset two-factor authentication')}
                    </Button>
                  </Confirm>
                </Tooltip>
              </Field>
            </PanelBody>
          </Panel>
        )}

        <RoleSelect
          enforceAllowed={false}
          disabled={!canEdit}
          roleList={member.roles}
          selectedRole={member.role}
          setRole={slug => this.setState({member: {...member, role: slug}})}
        />

        <Teams slugs={member.teams}>
          {({teams, initiallyLoaded}) => (
            <TeamSelect
              organization={organization}
              selectedTeams={teams}
              disabled={!canEdit}
              onAddTeam={this.handleAddTeam}
              onRemoveTeam={this.handleRemoveTeam}
              loadingTeams={!initiallyLoaded}
            />
          )}
        </Teams>

        <Footer>
          <Button
            priority="primary"
            busy={this.state.busy}
            onClick={this.handleSave}
            disabled={!canEdit}
          >
            {t('Save Member')}
          </Button>
        </Footer>
      </Fragment>
    );
  }
}

export default withOrganization(OrganizationMemberDetail);

const ExtraHeaderText = styled('div')`
  color: ${p => p.theme.gray300};
  font-weight: normal;
  font-size: ${p => p.theme.fontSizeLarge};
`;

const Details = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-template-columns: 2fr 1fr 1fr;
  gap: ${space(2)};
  width: 100%;

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-auto-flow: row;
    grid-template-columns: auto;
  }
`;

const DetailLabel = styled('div')`
  font-weight: bold;
  margin-bottom: ${space(0.5)};
  color: ${p => p.theme.textColor};
`;

const OverflowWrapper = styled('div')`
  overflow: hidden;
  flex: 1;
`;

const InviteSection = styled('div')`
  border-top: 1px solid ${p => p.theme.border};
  margin-top: ${space(2)};
  padding-top: ${space(2)};
`;

const CodeInput = styled('code')`
  ${p => inputStyles(p)}; /* Have to do this for typescript :( */
`;

const InviteActions = styled('div')`
  display: grid;
  gap: ${space(1)};
  grid-auto-flow: column;
  justify-content: flex-end;
  margin-top: ${space(2)};
`;

const Footer = styled('div')`
  display: flex;
  justify-content: flex-end;
`;
