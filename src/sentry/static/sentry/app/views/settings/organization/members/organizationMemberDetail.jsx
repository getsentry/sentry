import {browserHistory} from 'react-router';
import React from 'react';

import {resendMemberInvite, updateMember} from '../../../../actionCreators/members';
import {t} from '../../../../locale';
import AsyncView from '../../../asyncView';
import Button from '../../../../components/buttons/button';
import DateTime from '../../../../components/dateTime';
import IndicatorStore from '../../../../stores/indicatorStore';
import NotFound from '../../../../components/errors/notFound';
import recreateRoute from '../../../../utils/recreateRoute';
import RoleSelect from '../../../inviteMember/roleSelect';
import SentryTypes from '../../../../proptypes';
import TeamSelect from '../../../inviteMember/teamSelect';

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
      stepBack: -1,
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
        IndicatorStore.add('Saved', 'success', {duration: 5000});
        let members = recreateRoute('members/', {
          routes: this.props.routes,
          params: this.props.params,
          stepBack: -1,
        });
        browserHistory.push(members);
      })
      .catch(() => IndicatorStore.add('Could not save...', 'error', {duration: 5000}))
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

    return (
      <div>
        <div className="page-header">
          <h3>
            {member.name}
            <br />
            <small>Member Settings</small>
          </h3>
        </div>

        {error && error.role && <p className="error alert-error">{error.role}</p>}

        <div className="box">
          <div className="box-header">
            <h3>{t('Basics')}</h3>
          </div>

          <div className="box-content with-padding">
            <div className="row" style={{marginBottom: '10px'}}>
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
                    <code className="auto-select form-control" style={{overflow: 'auto'}}>
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
          </div>
        </div>

        <RoleSelect
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
