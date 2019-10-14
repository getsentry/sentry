import {browserHistory} from 'react-router';
import React from 'react';
import * as Sentry from '@sentry/browser';

import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {removeAuthenticator} from 'app/actionCreators/account';
import {resendMemberInvite, updateMember} from 'app/actionCreators/members';
import {t, tct} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import AutoSelectText from 'app/components/autoSelectText';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import DateTime from 'app/components/dateTime';
import Field from 'app/views/settings/components/forms/field';
import IndicatorStore from 'app/stores/indicatorStore';
import NotFound from 'app/components/errors/notFound';
import SentryTypes from 'app/sentryTypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TeamSelect from 'app/views/settings/components/teamSelect';
import Tooltip from 'app/components/tooltip';
import recreateRoute from 'app/utils/recreateRoute';

import RoleSelect from './inviteMember/roleSelect';

const MULTIPLE_ORGS = t('Cannot be reset since user is in more than one organization');
const NOT_ENROLLED = t('Not enrolled in two-factor authentication');
const NO_PERMISSION = t('You do not have permission to perform this action');
const TWO_FACTOR_REQUIRED = t(
  'Cannot be reset since two-factor is required for this organization'
);

class OrganizationMemberDetail extends AsyncView {
  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  constructor(...args) {
    super(...args);

    this.state = {
      ...this.state,
      roleList: [],
      selectedRole: '',
      member: null,
    };
  }

  getEndpoints() {
    const {slug} = this.getOrganization();
    const {params} = this.props;
    return [['member', `/organizations/${slug}/members/${params.memberId}/`]];
  }

  getOrganization() {
    return this.context.organization;
  }

  redirectToMemberPage() {
    const members = recreateRoute('members/', {
      routes: this.props.routes,
      params: this.props.params,
      stepBack: -2,
    });
    browserHistory.push(members);
  }

  handleSave = () => {
    const {slug} = this.getOrganization();
    const {params} = this.props;

    const indicator = IndicatorStore.add('Saving...');
    this.setState({busy: true});

    updateMember(this.api, {
      orgId: slug,
      memberId: params.memberId,
      data: this.state.member,
    })
      .then(() => {
        IndicatorStore.addSuccess('Saved');
        this.redirectToMemberPage();
      })
      .catch(() => IndicatorStore.addError('Could not save...'))
      .then(() => {
        IndicatorStore.remove(indicator);
        this.setState({busy: false});
      });
  };

  handleInvite = regenerate => {
    const {slug} = this.getOrganization();
    const {params} = this.props;

    const indicator = IndicatorStore.add('Sending invite...');
    this.setState({busy: true});

    resendMemberInvite(this.api, {
      orgId: slug,
      memberId: params.memberId,
      regenerate,
    })
      .then(data => {
        IndicatorStore.add('Sent invite!', 'success', {duration: 5000});
        if (regenerate) {
          this.setState(state => ({member: {...state.member, ...data}}));
        }
      })
      .catch(() => IndicatorStore.add('Could not send invite', 'error', {duration: 5000}))
      .then(() => {
        IndicatorStore.remove(indicator);
        this.setState({busy: false});
      });
  };

  handleAddTeam = team => {
    const {member} = this.state;
    if (!member.teams.includes(team.slug)) {
      member.teams.push(team.slug);
    }
    this.setState({member});
  };

  handleRemoveTeam = removedTeam => {
    const {member} = this.state;

    this.setState({
      member: {
        ...member,
        teams: member.teams.filter(slug => slug !== removedTeam),
      },
    });
  };

  handle2faReset = () => {
    const {user} = this.state.member;
    const {slug} = this.getOrganization();

    const requests = user.authenticators.map(auth =>
      removeAuthenticator(this.api, user.id, auth.id)
    );

    Promise.all(requests)
      .then(() => {
        this.props.router.push(`/settings/${slug}/members/`);
        addSuccessMessage(t('All authenticators have been removed'));
      })
      .catch(err => {
        addErrorMessage(t('Error removing authenticators'));
        Sentry.captureException(err);
      });
  };

  showResetButton = () => {
    const {member} = this.state;
    const {require2FA} = this.getOrganization();
    const {user} = member;

    if (!user || !user.authenticators || require2FA) {
      return false;
    }
    const hasAuth = user.authenticators.length >= 1;
    return hasAuth && user.canReset2fa;
  };

  getTooltip = () => {
    const {member} = this.state;
    const {require2FA} = this.getOrganization();
    const {user} = member;

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
    if (require2FA) {
      return TWO_FACTOR_REQUIRED;
    }

    return '';
  };

  renderBody() {
    const {error, member} = this.state;
    const organization = this.getOrganization();
    const access = organization.access;

    if (!member) {
      return <NotFound />;
    }

    const inviteLink = member.invite_link;
    const canEdit = access.includes('org:write');

    const {email, expired, pending} = member;
    const canResend = !expired;
    const showAuth = !pending;

    return (
      <div>
        <SettingsPageHeader
          title={
            <div>
              <div style={{fontSize: '1.4em'}}>{member.name}</div>
              <div>
                <small style={{opacity: 0.6, fontSize: '0.8em', fontWeight: 'normal'}}>
                  {t('Member Settings')}
                </small>
              </div>
            </div>
          }
        />

        {error && error.role && <p className="error alert-error">{error.role}</p>}

        <Panel>
          <PanelHeader>{t('Basics')}</PanelHeader>

          <PanelBody>
            <PanelItem direction="column">
              <div className="row" style={{width: '100%'}}>
                <div className="col-md-6">
                  <div className="control-group">
                    <label>{t('Email')}</label>
                    <div className="controls">
                      <a href={`mailto:${email}`}>{email}</a>
                    </div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="control-group">
                    <label>{t('Status')}</label>
                    <div className="controls" data-test-id="member-status">
                      {member.expired ? (
                        <em>Invitation Expired</em>
                      ) : member.pending ? (
                        <em>Invitation Pending</em>
                      ) : (
                        'Active'
                      )}
                    </div>
                  </div>
                </div>
                <div className="col-md-3">
                  <div className="control-group">
                    <label>{t('Added')}</label>
                    <div className="controls">
                      <DateTime dateOnly date={member.dateCreated} />
                    </div>
                  </div>
                </div>
              </div>

              {inviteLink && (
                <div className="form-actions">
                  <div className="control-group">
                    <label>{t('Invite Link')}</label>
                    <AutoSelectText className="controls">
                      <code className="form-control" style={{overflow: 'auto'}}>
                        {inviteLink}
                      </code>
                    </AutoSelectText>
                    <p className="help-block">
                      This unique invite link may only be used by this member.
                    </p>
                  </div>
                  <div className="align-right">
                    <Button
                      style={{marginRight: 10}}
                      onClick={() => this.handleInvite(true)}
                    >
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
                  </div>
                </div>
              )}
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

        <TeamSelect
          organization={organization}
          selectedTeams={member.teams}
          disabled={!canEdit}
          onAddTeam={this.handleAddTeam}
          onRemoveTeam={this.handleRemoveTeam}
        />

        <Button
          priority="primary"
          busy={this.state.busy}
          className="invite-member-submit"
          onClick={this.handleSave}
          disabled={!canEdit}
        >
          {t('Save Member')}
        </Button>
      </div>
    );
  }
}

export default OrganizationMemberDetail;
