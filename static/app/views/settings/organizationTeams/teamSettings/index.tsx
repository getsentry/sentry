import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {
  defaultFormOptions,
  FieldGroup,
  FormSearch,
  useScrapsForm,
} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {removeTeam, updateTeamSuccess} from 'sentry/actionCreators/teams';
import {hasEveryAccess} from 'sentry/components/acl/access';
import Confirm from 'sentry/components/confirm';
import LegacyFieldGroup from 'sentry/components/forms/fieldGroup';
import Panel from 'sentry/components/panels/panel';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconDelete} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Team} from 'sentry/types/organization';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {fetchMutation, useMutation} from 'sentry/utils/queryClient';
import slugify from 'sentry/utils/slugify';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useTeamDetailsOutlet} from 'sentry/views/settings/organizationTeams/teamDetails';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';

const teamSettingsSchema = z.object({
  slug: z.string().min(1, t('Team slug is required')),
  teamId: z.string(),
});

export default function TeamSettings() {
  const navigate = useNavigate();
  const organization = useOrganization();
  const api = useApi();
  const {team} = useTeamDetailsOutlet();

  const mutation = useMutation<Team, Error, {slug: string}>({
    mutationFn: (data: {slug: string}) =>
      fetchMutation<Team>({
        method: 'PUT',
        url: getApiUrl('/teams/$organizationIdOrSlug/$teamIdOrSlug/', {
          path: {
            organizationIdOrSlug: organization.slug,
            teamIdOrSlug: team.slug,
          },
        }),
        data,
      }),
    onSuccess: (resp: Team) => {
      updateTeamSuccess(team.slug, resp);
      addSuccessMessage(t('Team name changed'));
      navigate(`/settings/${organization.slug}/teams/${resp.slug}/settings/`, {
        replace: true,
      });
    },
    onError: () => {
      addErrorMessage(t('Unable to save change'));
    },
  });

  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {slug: team.slug, teamId: team.id},
    validators: {onDynamic: teamSettingsSchema},
    onSubmit: ({value}) => mutation.mutateAsync({slug: value.slug}).catch(() => {}),
  });

  const handleRemoveTeam = async () => {
    try {
      await removeTeam(api, {orgId: organization.slug, teamId: team.slug});
      navigate(`/settings/${organization.slug}/teams/`, {replace: true});
    } catch {
      // removeTeam already displays an error message
    }
  };

  const hasTeamWrite = hasEveryAccess(['team:write'], {organization, team});
  const hasTeamAdmin = hasEveryAccess(['team:admin'], {organization, team});
  const isIdpProvisioned = team.flags['idp:provisioned'];
  const isDisabled = isIdpProvisioned || !hasTeamWrite;

  return (
    <FormSearch route="/settings/:orgId/teams/:teamId/settings/">
      <SentryDocumentTitle title={t('Team Settings')} orgSlug={organization.slug} />

      <ProjectPermissionAlert access={['team:write']} team={team} />
      {isIdpProvisioned && (
        <Alert.Container>
          <Alert variant="warning">
            {t(
              "This team is managed through your organization's identity provider. These settings cannot be modified."
            )}
          </Alert>
        </Alert.Container>
      )}

      <form.AppForm>
        <form.FormWrapper>
          <FieldGroup title={t('Team Settings')}>
            <form.AppField name="slug">
              {field => (
                <field.Layout.Row
                  label={t('Team Slug')}
                  hintText={t('A unique ID used to identify the team')}
                  required
                >
                  <field.Input
                    value={field.state.value}
                    onChange={value => field.handleChange(slugify(value))}
                    placeholder="e.g. operations, web-frontend, mobile-ios"
                    disabled={isDisabled}
                  />
                </field.Layout.Row>
              )}
            </form.AppField>
            <form.AppField name="teamId">
              {field => (
                <field.Layout.Row
                  label={t('Team ID')}
                  hintText={t(
                    'The unique identifier for this team. It cannot be modified.'
                  )}
                >
                  <field.Input
                    value={field.state.value}
                    onChange={field.handleChange}
                    disabled
                  />
                </field.Layout.Row>
              )}
            </form.AppField>

            {isDisabled ? null : (
              <Flex gap="md" align="center" padding="sm">
                <form.Subscribe selector={state => state.values.slug !== team.slug}>
                  {hasChanged => (
                    <Flex
                      flex="1"
                      minWidth={0}
                      style={{visibility: hasChanged ? 'visible' : 'hidden'}}
                    >
                      <Alert variant="info">
                        {t('You will be redirected to the new team slug after saving.')}
                      </Alert>
                    </Flex>
                  )}
                </form.Subscribe>
                <Flex gap="sm" flexShrink={0}>
                  <Button onClick={() => form.reset()}>{t('Cancel')}</Button>
                  <form.SubmitButton>{t('Save')}</form.SubmitButton>
                </Flex>
              </Flex>
            )}
          </FieldGroup>
        </form.FormWrapper>
      </form.AppForm>

      <Panel>
        <PanelHeader>{t('Team Administration')}</PanelHeader>
        <LegacyFieldGroup
          disabled={isIdpProvisioned}
          label={t('Remove Team')}
          help={t(
            "This may affect team members' access to projects and associated alert delivery."
          )}
        >
          <div>
            <Confirm
              disabled={isIdpProvisioned || !hasTeamAdmin}
              onConfirm={() => {
                handleRemoveTeam();
              }}
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
        </LegacyFieldGroup>
      </Panel>
    </FormSearch>
  );
}
