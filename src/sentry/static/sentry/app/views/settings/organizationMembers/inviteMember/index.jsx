import {withRouter} from 'react-router';
import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';
import * as Sentry from '@sentry/react';

import {addErrorMessage, addSuccessMessage} from 'app/actionCreators/indicator';
import {MEMBER_ROLES} from 'app/constants';
import {t, tct} from 'app/locale';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import SentryTypes from 'app/sentryTypes';
import Button from 'app/components/button';
import ConfigStore from 'app/stores/configStore';
import LoadingIndicator from 'app/components/loadingIndicator';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import TextBlock from 'app/views/settings/components/text/textBlock';
import TextField from 'app/components/forms/textField';
import TeamSelect from 'app/views/settings/components/teamSelect';
import replaceRouterParams from 'app/utils/replaceRouterParams';

import RoleSelect from './roleSelect';

class InviteMember extends React.Component {
  static propTypes = {
    api: PropTypes.object,
    organization: SentryTypes.Organization.isRequired,
    router: PropTypes.object,
  };

  constructor(props) {
    super(props);
    const {teams} = props.organization;
    //select team if there's only one
    const initialTeamSelection = teams.length === 1 ? [teams[0].slug] : [];

    this.state = {
      selectedTeams: new Set(initialTeamSelection),
      roleList: [],
      selectedRole: 'member',
      email: '',
      loading: true,
      busy: false,
      error: undefined,
    };
  }

  componentDidMount() {
    const {slug} = this.props.organization;
    const {isSuperuser} = ConfigStore.get('user');

    this.props.api.request(`/organizations/${slug}/members/me/`, {
      method: 'GET',
      success: resp => {
        const {roles} = resp || {};

        if (!resp || !roles) {
          this.setState({
            loading: false,
            error: {
              role: 'Error loading roles, will default to "member"',
            },
          });

          Sentry.withScope(scope => {
            scope.setExtra('resp', resp);
            scope.setExtra('state', this.state);
            Sentry.captureException(new Error('[members]: data fetch invalid response'));
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
        if (error.status === 404 && isSuperuser) {
          // use the static list
          this.setState({roleList: MEMBER_ROLES, loading: false});
        } else if (error.status !== 0) {
          Sentry.withScope(scope => {
            scope.setExtra('error', error);
            scope.setExtra('state', this.state);
            Sentry.captureException(new Error('[members]: data fetch error'));
          });
        }

        addErrorMessage(t('Error with request, please reload'));
      },
    });
  }

  redirectToMemberPage = () => {
    // Get path to parent route (`/organizations/${slug}/members/`)
    // `recreateRoute` fucks up because of getsentry hooks
    const {params, router} = this.props;
    const isNewSettings = /^\/settings\//.test(router.location.pathname);
    const pathToParentRoute = isNewSettings
      ? '/settings/:orgId/members/'
      : '/organizations/:orgId/members/';
    router.push(replaceRouterParams(pathToParentRoute, params));
  };

  splitEmails = text =>
    text
      .split(',')
      .map(e => e.trim())
      .filter(e => e);

  inviteUser = email => {
    const {slug} = this.props.organization;
    const {selectedTeams, selectedRole} = this.state;

    return new Promise((resolve, reject) => {
      this.props.api.request(`/organizations/${slug}/members/`, {
        method: 'POST',
        data: {
          email,
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
  };

  submit = () => {
    const {email} = this.state;
    const emails = this.splitEmails(email);
    if (!emails.length) {
      return;
    }
    this.setState({busy: true});
    Promise.all(emails.map(this.inviteUser))
      .then(() => this.redirectToMemberPage())
      .catch(error => {
        if (error && !error.email && !error.role) {
          Sentry.withScope(scope => {
            scope.setExtra('error', error);
            scope.setExtra('state', this.state);
            Sentry.captureException(new Error('Unknown invite member api response'));
          });
        }
        this.setState({error, busy: false});
      });
  };

  handleAddTeam = team => {
    const {selectedTeams} = this.state;
    if (!selectedTeams.has(team.slug)) {
      selectedTeams.add(team.slug);
    }
    this.setState({selectedTeams});
  };

  handleRemoveTeam = teamSlug => {
    const {selectedTeams} = this.state;
    selectedTeams.delete(teamSlug);

    this.setState({selectedTeams});
  };

  render() {
    const {error, loading, roleList, selectedRole, selectedTeams} = this.state;
    const {organization} = this.props;
    const {invitesEnabled} = ConfigStore.getConfig();
    const {isSuperuser} = ConfigStore.get('user');

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
              organization={organization}
              selectedTeams={Array.from(selectedTeams.values())}
              onAddTeam={this.handleAddTeam}
              onRemoveTeam={this.handleRemoveTeam}
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
  }
}

export {InviteMember};
export default withApi(withRouter(withOrganization(InviteMember)));
