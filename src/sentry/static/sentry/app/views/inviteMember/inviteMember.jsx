import React from 'react';

import OrganizationHomeContainer from '../../components/organizations/homeContainer';
import Checkbox from '../../components/checkbox';
import Radio from '../../components/radio';

import TextField from '../../components/forms/textField';

import ConfigStore from '../../stores/configStore';
import ApiMixin from '../../mixins/apiMixin';
import OrganizationState from '../../mixins/organizationState';

import {t} from '../../locale';

const InviteMember = React.createClass({
  mixins: [ApiMixin, OrganizationState],

  getInitialState() {
    return {
      selectedTeams: new Set(),
      roleList: [],
      selectedRole: 'member',
      email: '',
      error: undefined
    };
  },

  componentDidMount() {
    let {slug} = this.getOrganization();
    let user = ConfigStore.get('user');

    this.api.request(`/organizations/${slug}/members/${user.id}/`, {
      method: 'GET',
      success: data => {
        this.setState({roleList: data.role_list});
      },
      error: err => {
        Raven.captureMessage(err);
      }
    });
  },

  splitEmails(text) {
    return text.split(',').filter(i => i);
  },

  inviteUser(email) {
    let {slug} = this.getOrganization();
    let {selectedTeams, selectedRole} = this.state;
    return new Promise((resolve, reject) => {
      this.api.request(`/organizations/${slug}/members/`, {
        method: 'POST',
        data: {
          email,
          teams: Array.from(selectedTeams.keys()),
          role: selectedRole
        },
        success: resolve,
        error: err => {
          reject(err.responseJSON);
        }
      });
    });
  },

  submit() {
    let {email} = this.state;
    let emails = this.splitEmails(email);
    if (!emails.length) return;

    emails //These are done in series and not parallel becuase django messages don't work on parallel requests
      .reduce((prev, cur_email) => {
        return prev.then(() => this.inviteUser(cur_email));
      }, Promise.resolve())
      .then(values => {
        console.log(values);
        this.onSubmitSuccess();
      })
      .catch(error => {
        console.log(error);
        this.setState({error: error});
      });
  },

  toggleID(id) {
    let {selectedTeams} = this.state;
    this.setState({
      selectedTeams: selectedTeams.has(id)
        ? (selectedTeams.delete(id), selectedTeams)
        : selectedTeams.add(id)
    });
  },
  onSubmitSuccess() {
    let {orgId} = this.props.params;
    // redirect to member page
    window.location.href = `/organizations/${orgId}/members/`;
  },

  renderRoleSelect() {
    let {roleList, selectedRole} = this.state;

    return (
      <div className="new-invite-team box">
        <div className="box-header">
          <h4>{t('Team') + ':'}</h4>
        </div>
        <div className="box-content with-padding">
          <ul className="radio-inputs">
            {roleList.map(({role, allowed}, i) => {
              let {desc, name, id} = role;
              return (
                <li
                  className="radio"
                  key={id}
                  onClick={() => this.setState({selectedRole: id})}>
                  <label>
                    <Radio id={id} value={name} checked={id === selectedRole} readOnly />
                    {name}
                    <div className="help-block">{desc}</div>
                  </label>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    );
  },

  renderTeamSelect() {
    let org = this.getOrganization();
    let {teams} = org;
    let {selectedTeams} = this.state;

    if (teams.length < 2) return null;
    return (
      <div className="new-invite-team box">
        <div className="box-header">
          <h4>{t('Team') + ':'}</h4>
        </div>
        <div className="grouping-controls team-choices row box-content with-padding">
          {teams.map(({slug, name, id}, i) => (
            <div
              key={id}
              onClick={e => {
                e.preventDefault();
                this.toggleID(id);
              }}
              className="col-md-3">
              <label className="checkbox">
                <Checkbox id={id} value={name} checked={selectedTeams.has(id)} />
                {name}
                <span className="team-slug">{slug}</span>
              </label>
            </div>
          ))}
        </div>
      </div>
    );
  },

  render() {
    let {orgId} = this.props.params;
    let {error} = this.state;
    return (
      <OrganizationHomeContainer>
        <a className="pull-right" href={`/organizations/${orgId}/members/`}>
          {t('Members List')}&nbsp;
        </a>
        <h3>{t('Add Member to Organization')}</h3>
        <p>
          {t(
            'Invite a member to join this organization via their email address. If they do not already have an account, they will first be asked to create one.'
          )}
        </p>
        {error && <p className="error">{error.toString()}</p>}
        <TextField
          name="email"
          label="Email"
          placeholder="e.g. teammate@example.com"
          onChange={v => this.setState({email: v})}
        />
        {this.renderRoleSelect()}
        {this.renderTeamSelect()}
        <button className="btn btn-primary submit-new-team" onClick={this.submit}>
          {t('Add Member')}
        </button>
      </OrganizationHomeContainer>
    );
  }
});

export default InviteMember;
