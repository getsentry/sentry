import {Fragment} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {removeTeam, updateTeamSuccess} from 'sentry/actionCreators/teams';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import Form, {FormProps} from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import {Panel, PanelHeader} from 'sentry/components/panels';
import teamSettingsFields from 'sentry/data/forms/teamSettingsFields';
import {IconDelete} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {Organization, Scope, Team} from 'sentry/types';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import withOrganization from 'sentry/utils/withOrganization';
import AsyncView from 'sentry/views/asyncView';

type Props = RouteComponentProps<{teamId: string}, {}> & {
  organization: Organization;
  team: Team;
};

type State = AsyncView['state'];

class TeamSettings extends AsyncView<Props, State> {
  getTitle() {
    return 'Team Settings';
  }

  getEndpoints() {
    return [];
  }

  handleSubmitSuccess: FormProps['onSubmitSuccess'] = (resp, _model, id) => {
    const {organization} = this.props;

    // Use the old slug when triggering the update so we correctly replace the
    // previous team in the store
    updateTeamSuccess(this.props.team.slug, resp);
    if (id === 'slug') {
      addSuccessMessage(t('Team name changed'));
      browserHistory.replace(
        normalizeUrl(`/settings/${organization.slug}/teams/${resp.slug}/settings/`)
      );
      this.setState({loading: true});
    }
  };

  handleRemoveTeam = async () => {
    const {organization, params} = this.props;
    try {
      await removeTeam(this.api, {orgId: organization.slug, teamId: params.teamId});
      browserHistory.replace(normalizeUrl(`/settings/${organization.slug}/teams/`));
    } catch {
      // removeTeam already displays an error message
    }
  };

  renderBody() {
    const {organization, team} = this.props;

    const access = new Set<Scope>(organization.access);
    const idpProvisioned = team.flags['idp:provisioned'];
    const orgRoleList = organization.orgRoleList;
    const hasOrgRoleFlag = organization.features.includes('org-roles-for-teams');

    return (
      <Fragment>
        <Form
          apiMethod="PUT"
          apiEndpoint={`/teams/${organization.slug}/${team.slug}/`}
          saveOnBlur
          allowUndo
          onSubmitSuccess={this.handleSubmitSuccess}
          onSubmitError={() => addErrorMessage(t('Unable to save change'))}
          initialData={{
            name: team.name,
            slug: team.slug,
            orgRole: team.orgRole,
          }}
        >
          <JsonForm
            access={access}
            additionalFieldProps={{idpProvisioned, hasOrgRoleFlag, orgRoleList}}
            forms={teamSettingsFields}
          />
        </Form>

        <Panel>
          <PanelHeader>{t('Remove Team')}</PanelHeader>
          <FieldGroup
            help={t(
              "This may affect team members' access to projects and associated alert delivery."
            )}
          >
            <div>
              <Confirm
                disabled={!access.has('team:admin')}
                onConfirm={this.handleRemoveTeam}
                priority="danger"
                message={tct('Are you sure you want to remove the team [team]?', {
                  team: `#${team.slug}`,
                })}
              >
                <Button
                  icon={<IconDelete />}
                  priority="danger"
                  disabled={!access.has('team:admin')}
                >
                  {t('Remove Team')}
                </Button>
              </Confirm>
            </div>
          </FieldGroup>
        </Panel>
      </Fragment>
    );
  }
}
export default withOrganization(TeamSettings);
