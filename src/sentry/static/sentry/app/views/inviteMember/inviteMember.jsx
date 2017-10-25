import React from 'react';
import classNames from 'classnames';

import OrganizationState from '../../mixins/organizationState';
import ApiMixin from '../../mixins/apiMixin';
import AlertActions from '../../actions/alertActions';

import Button from '../../components/buttons/button';
import LoadingIndicator from '../../components/loadingIndicator';
import TextField from '../../components/forms/textField';

import RoleSelect from './roleSelect';
import TeamSelect from './teamSelect';

import ConfigStore from '../../stores/configStore';
import {t} from '../../locale';

const InviteMember = React.createClass({
  mixins: [ApiMixin, OrganizationState],

  getInitialState() {
    let {teams} = this.getOrganization();

    //select team if there's only one
    let initialTeamSelection = teams.length === 1 ? [teams[0].slug] : [];

    return {
      selectedTeams: new Set(initialTeamSelection),
      roleList: [],
      selectedRole: 'member',
      email: '',
      loading: true,
      error: undefined
    };
  },

  componentDidMount() {
    let {slug} = this.getOrganization();
    this.api.request(`/organizations/${slug}/members/me/`, {
      method: 'GET',
      success: ({allowed_roles}) => {
        this.setState({roleList: allowed_roles, loading: false});
        if (allowed_roles.filter(({_, allowed}) => allowed).length === 0) {
          //not allowed to invite, redirect
          this.redirectToMemberPage();
        }
      },
      error: error => {
        Raven.captureMessage('data fetch error ', {
          extra: {error, state: this.state}
        });
      }
    });
  },

  redirectToMemberPage() {
    let {slug} = this.getOrganization();
    window.location.href = `/organizations/${slug}/members/`;
  },

  splitEmails(text) {
    return text.split(',').map(e => e.trim()).filter(e => e);
  },

  inviteUser(email) {
    let {slug} = this.getOrganization();
    let {selectedTeams, selectedRole} = this.state;

    return new Promise((resolve, reject) => {
      this.api.request(`/organizations/${slug}/members/`, {
        method: 'POST',
        data: {
          email,
          user: email,
          teams: Array.from(selectedTeams.keys()),
          role: selectedRole
        },
        success: () => {
          AlertActions.addAlert({
            message: `Added ${email}`,
            type: 'success'
          });
          resolve();
        },
        error: err => {
          if (err.status === 401) {
            AlertActions.addAlert({
              message: "You aren't allowed to invite members.",
              type: 'error'
            });
            reject(err.responseJSON);
          } else if (err.status === 409) {
            AlertActions.addAlert({
              message: `User already exists: ${email}`,
              type: 'info'
            });
            resolve();
          } else {
            reject(err.responseJSON);
          }
        }
      });
    });
  },

  submit() {
    let {email} = this.state;
    let emails = this.splitEmails(email);
    if (!emails.length) return;
    this.setState({loading: true});

    Promise.all(emails.map(this.inviteUser))
      .then(() => setTimeout(this.redirectToMemberPage, 3000))
      .catch(error => {
        if (!error.email && !error.role) {
          Raven.captureMessage('unkown error ', {
            extra: {error, state: this.state}
          });
        }
        this.setState({error, loading: false});
      });
  },

  toggleTeam(slug) {
    let {selectedTeams} = this.state;
    if (selectedTeams.has(slug)) {
      selectedTeams.delete(slug);
    } else {
      selectedTeams.add(slug);
    }
    this.setState({selectedTeams});
  },

  render() {
    let {error, loading, roleList, selectedRole, selectedTeams} = this.state;
    let {teams} = this.getOrganization();
    let {invitesEnabled} = ConfigStore.getConfig();
    return (
      <div>
        <h3>{t('Add Member to Organization')}</h3>
        <p>
          {invitesEnabled
            ? t(
                'Invite a member to join this organization via their email address. If they do not already have an account, they will first be asked to create one. Multiple emails delimited by commas.'
              )
            : t(
                'You may add a user by their username if they already have an account. Multiple inputs delimited by commas.'
              )}
        </p>
        <div className={classNames({'has-error': error && error.email})}>
          {loading && <LoadingIndicator mini className="pull-right" />}
          <TextField
            name="email"
            label={invitesEnabled ? t('Email') + '(s)' : t('Username') + '(s)'}
            placeholder="e.g. teammate@example.com"
            spellCheck="false"
            onChange={v => this.setState({email: v})}
          />
          {error && error.email && <p className="error">{error.email}</p>}
        </div>
        {error && error.role && <p className="error alert-error">{error.role}</p>}
        <RoleSelect
          roleList={roleList}
          selectedRole={selectedRole}
          setRole={slug => this.setState({selectedRole: slug})}
        />
        <TeamSelect
          teams={teams}
          selectedTeams={selectedTeams}
          toggleTeam={this.toggleTeam}
        />
        <Button priority="primary" className="invite-member-submit" onClick={this.submit}>
          {t('Add Member')}
        </Button>
      </div>
    );
  }
});

export default InviteMember;
