import {Fragment} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {removeTeam, updateTeamSuccess} from 'sentry/actionCreators/teams';
import {hasEveryAccess} from 'sentry/components/acl/access';
import {Button} from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import Form, {FormProps} from 'sentry/components/forms/form';
import JsonForm from 'sentry/components/forms/jsonForm';
import Panel from 'sentry/components/panels/panel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import teamSettingsFields from 'sentry/data/forms/teamSettingsFields';
import {IconDelete} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {Team} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import PermissionAlert from 'sentry/views/settings/project/permissionAlert';

interface TeamSettingsProps extends RouteComponentProps<{teamId: string}, {}> {
  team: Team;
}

function TeamSettings({team, params}: TeamSettingsProps) {
  const organization = useOrganization();
  const api = useApi();

  const handleSubmitSuccess: FormProps['onSubmitSuccess'] = (resp: Team, _model, id) => {
    // Use the old slug when triggering the update so we correctly replace the
    // previous team in the store
    updateTeamSuccess(team.slug, resp);
    if (id === 'slug') {
      addSuccessMessage(t('Team name changed'));
      browserHistory.replace(
        normalizeUrl(`/settings/${organization.slug}/teams/${resp.slug}/settings/`)
      );
    }
  };

  const handleRemoveTeam = async () => {
    try {
      await removeTeam(api, {orgId: organization.slug, teamId: params.teamId});
      browserHistory.replace(normalizeUrl(`/settings/${organization.slug}/teams/`));
    } catch {
      // removeTeam already displays an error message
    }
  };

  const idpProvisioned = team.flags['idp:provisioned'];
  const orgRoleList = organization.orgRoleList;
  const hasOrgRoleFlag = organization.features.includes('org-roles-for-teams');

  const hasTeamWrite = hasEveryAccess(['team:write'], {organization, team});
  const hasTeamAdmin = hasEveryAccess(['team:admin'], {organization, team});
  const hasOrgAdmin = hasEveryAccess(['org:admin'], {organization});

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Team Settings')} orgSlug={organization.slug} />

      <PermissionAlert access={['team:write']} team={team} />

      <Form
        apiMethod="PUT"
        apiEndpoint={`/teams/${organization.slug}/${team.slug}/`}
        saveOnBlur
        allowUndo
        onSubmitSuccess={handleSubmitSuccess}
        onSubmitError={() => addErrorMessage(t('Unable to save change'))}
        initialData={{
          name: team.name,
          slug: team.slug,
          orgRole: team.orgRole,
        }}
      >
        <JsonForm
          additionalFieldProps={{
            idpProvisioned,
            hasOrgRoleFlag,
            hasTeamWrite,
            hasOrgAdmin,
            orgRoleList,
          }}
          forms={teamSettingsFields}
        />
      </Form>

      <Panel>
        <PanelHeader>{t('Team Administration')}</PanelHeader>
        <FieldGroup
          label={t('Remove Team')}
          help={t(
            "This may affect team members' access to projects and associated alert delivery."
          )}
        >
          <div>
            <Confirm
              disabled={!hasTeamAdmin}
              onConfirm={handleRemoveTeam}
              priority="danger"
              message={tct('Are you sure you want to remove the team [team]?', {
                team: `#${team.slug}`,
              })}
            >
              <Button
                icon={<IconDelete />}
                priority="danger"
                data-test-id="button-remove-team"
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

export default TeamSettings;
