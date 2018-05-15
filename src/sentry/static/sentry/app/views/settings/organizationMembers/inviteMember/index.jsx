import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import createReactClass from 'create-react-class';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {t, tct} from 'app/locale';
import ApiMixin from 'app/mixins/apiMixin';
import Button from 'app/components/buttons/button';
import ConfigStore from 'app/stores/configStore';
import LoadingIndicator from 'app/components/loadingIndicator';
import OrganizationState from 'app/mixins/organizationState';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import TextField from 'app/components/forms/textField';
import replaceRouterParams from 'app/utils/replaceRouterParams';

import RoleSelect from './roleSelect';
import TeamSelect from './teamSelect';

// These don't have allowed and are only used for superusers. superceded by server result of allowed roles
const STATIC_ROLE_LIST = [
  {
    id: 'member',
    name: 'Member',
    desc:
      'Members can view and act on events, as well as view most other data within the organization.',
  },
  {
    id: 'admin',
    name: 'Admin',
    desc:
      "Admin privileges on any teams of which they're a member. They can create new teams and projects, as well as remove teams and projects which they already hold membership on.",
  },
  {
    id: 'manager',
    name: 'Manager',
    desc:
      'Gains admin access on all teams as well as the ability to add and remove members.',
  },
  {
    id: 'owner',
    name: 'Owner',
    desc:
      'Gains full permission across the organization. Can manage members as well as perform catastrophic operations such as removing the organization.',
  },
];

const InviteMember = createReactClass({
  displayName: 'InviteMember',
  propTypes: {
    router: PropTypes.object,
  },
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
      busy: false,
      error: undefined,
    };
  },

  componentDidMount() {
    let {slug} = this.getOrganization();
    let {isSuperuser} = ConfigStore.get('user');

    this.api.request(`/organizations/${slug}/members/me/`, {
      method: 'GET',
      success: resp => {
        let {roles} = resp || {};

        if (!resp || !roles) {
          this.setState({
            loading: false,
            error: {
              role: 'Error loading roles, will default to "member"',
            },
          });

          Raven.captureMessage('[members]: data fetch invalid response', {
            extra: {resp, state: this.state},
          });
        } else {
          this.setState({roleList: roles, loading: false});

          if (roles.filter(({allowed}) => allowed).length === 0) {
            // not allowed to invite, redirect
            this.redirectToMemberPage();
          }
        }
      },
      error: error => {
        if (error.status == 404 && isSuperuser) {
          // use the static list
          this.setState({roleList: STATIC_ROLE_LIST, loading: false});
        } else {
          Raven.captureMessage('[members]: data fetch error ', {
            extra: {error, state: this.state},
          });
        }
      },
    });
  },

  redirectToMemberPage() {
    // Get path to parent route (`/organizations/${slug}/members/`)
    // `recreateRoute` fucks up because of getsentry hooks
    let {params, router} = this.props;
    let isNewSettings = /^\/settings\//.test(router.location.pathname);
    let pathToParentRoute = isNewSettings
      ? '/settings/:orgId/members/'
      : '/organizations/:orgId/members/';
    router.push(replaceRouterParams(pathToParentRoute, params));
  },

  splitEmails(text) {
    return text
      .split(',')
      .map(e => e.trim())
      .filter(e => e);
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
          role: selectedRole,
          referrer: this.props.location.query.referrer,
        },
        success: () => {
          addSuccessMessage(
            tct('Added [email] to [organization]', {
              email,
              organization: slug,
            })
          );
          resolve();
        },
        error: err => {
          if (err.status === 403) {
            addErrorMessage(t("You aren't allowed to invite members."));
            resolve();
          } else if (err.status === 409) {
            addErrorMessage(`User already exists: ${email}`);
            resolve();
          } else {
            reject(err.responseJSON);
          }
        },
      });
    });
  },

  submit() {
    let {email} = this.state;
    let emails = this.splitEmails(email);
    if (!emails.length) return;
    this.setState({busy: true});
    Promise.all(emails.map(this.inviteUser))
      .then(() => this.redirectToMemberPage())
      .catch(error => {
        if (error && !error.email && !error.role) {
          Raven.captureMessage('Unknown invite member api response', {
            extra: {error, state: this.state},
          });
        }
        this.setState({error, busy: false});
      });
  },

  toggleTeam(slug) {
    this.setState(state => {
      let {selectedTeams} = state;
      if (selectedTeams.has(slug)) {
        selectedTeams.delete(slug);
      } else {
        selectedTeams.add(slug);
      }
      return {
        selectedTeams,
      };
    });
  },

  render() {
    let {error, loading, roleList, selectedRole, selectedTeams} = this.state;
    let {teams} = this.getOrganization();
    let {invitesEnabled} = ConfigStore.getConfig();
    let {isSuperuser} = ConfigStore.get('user');

    return (
      <div>
        <SettingsPageHeader title={t('Add Member to Organization')} />
        <TextBlock>
          {invitesEnabled
            ? t(
                'Invite a member to join this organization via their email address. If they do not already have an account, they will first be asked to create one. Multiple emails delimited by commas.'
              )
            : t(
                'You may add a user by their username if they already have an account. Multiple inputs delimited by commas.'
              )}
        </TextBlock>

        {loading && <LoadingIndicator />}
        {!loading && (
          <div>
            <div className={classNames({'has-error': error && error.email})}>
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
              enforceAllowed={!isSuperuser}
              roleList={roleList}
              selectedRole={selectedRole}
              setRole={slug => this.setState({selectedRole: slug})}
            />
            <TeamSelect
              teams={teams}
              selectedTeams={selectedTeams}
              toggleTeam={this.toggleTeam}
            />
            <Button
              priority="primary"
              busy={this.state.busy}
              className="invite-member-submit"
              onClick={this.submit}
            >
              {t('Add Member')}
            </Button>
          </div>
        )}
      </div>
    );
  },
});

export {InviteMember};
export default withRouter(InviteMember);
