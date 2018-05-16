import {browserHistory} from 'react-router';
import React from 'react';

import {resendMemberInvite, updateMember} from 'app/actionCreators/members';
import {t} from 'app/locale';
import AsyncView from 'app/views/asyncView';
import Button from 'app/components/buttons/button';
import ConfigStore from 'app/stores/configStore';
import DateTime from 'app/components/dateTime';
import IndicatorStore from 'app/stores/indicatorStore';
import NotFound from 'app/components/errors/notFound';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import SentryTypes from 'app/proptypes';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import recreateRoute from 'app/utils/recreateRoute';

import RoleSelect from './inviteMember/roleSelect';
import TeamSelect from './inviteMember/teamSelect';

class OrganizationMemberDetail extends AsyncView {
  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  constructor(...args) {
    super(...args);
    let {teams} = this.getOrganization();

    this.state = {
      ...this.state,
      selectedTeams: new Set(teams.map(({slug}) => slug)),
      roleList: [],
      selectedRole: '',
      member: null,
    };
  }

  getEndpoints() {
    let {slug} = this.getOrganization();
    let {params} = this.props;
    return [['member', `/organizations/${slug}/members/${params.memberId}/`]];
  }

  getOrganization() {
    return this.context.organization;
  }

  redirectToMemberPage() {
    let members = recreateRoute('members/', {
      routes: this.props.routes,
      params: this.props.params,
      stepBack: -2,
    });
    browserHistory.push(members);
  }

  handleSave = () => {
    let {slug} = this.getOrganization();
    let {params} = this.props;

    let indicator = IndicatorStore.add('Saving...');
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
    let {slug} = this.getOrganization();
    let {params} = this.props;

    let indicator = IndicatorStore.add('Sending invite...');
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

  handleToggleTeam = slug => {
    let {member} = this.state;
    let selectedTeams = new Set(member.teams);
    if (selectedTeams.has(slug)) {
      selectedTeams.delete(slug);
    } else {
      selectedTeams.add(slug);
    }

    this.setState({
      member: {
        ...member,
        teams: Array.from(selectedTeams.values()),
      },
    });
  };

  renderBody() {
    let {error, member} = this.state;
    let {teams} = this.getOrganization();

    if (!member) return <NotFound />;

    let email = member.email;
    let inviteLink = member.invite_link;

    let currentUser = ConfigStore.get('user');
    let isCurrentUser = currentUser.email === email;
    let roleSelectDisabled = isCurrentUser;

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
                    <div className="controls">
                      {member.pending ? <em>Invitation Pending</em> : 'Active'}
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
                    <div className="controls">
                      <code
                        className="auto-select form-control"
                        style={{overflow: 'auto'}}
                      >
                        {inviteLink}
                      </code>
                    </div>
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
                    <Button onClick={() => this.handleInvite(false)}>
                      {t('Resend Invite')}
                    </Button>
                  </div>
                </div>
              )}
            </PanelItem>
          </PanelBody>
        </Panel>

        <RoleSelect
          enforceAllowed={false}
          disabled={roleSelectDisabled}
          roleList={member.roles}
          selectedRole={member.role}
          setRole={slug => this.setState({member: {...member, role: slug}})}
        />

        <TeamSelect
          teams={teams}
          selectedTeams={new Set(member.teams)}
          toggleTeam={this.handleToggleTeam}
        />

        <Button
          priority="primary"
          busy={this.state.busy}
          className="invite-member-submit"
          onClick={this.handleSave}
        >
          {t('Save Member')}
        </Button>
      </div>
    );
  }
}

export default OrganizationMemberDetail;
