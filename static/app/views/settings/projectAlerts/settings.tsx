import {z} from 'zod';

import {Alert} from '@sentry/scraps/alert';
import {LinkButton} from '@sentry/scraps/button';
import {AutoSaveForm, FieldGroup, FormSearch} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';

import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {DetailedProject} from 'sentry/types/project';
import {useUpdateProjectMutationOptions} from 'sentry/utils/project/useUpdateProject';
import {fetchMutation} from 'sentry/utils/queryClient';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {routeTitleGen} from 'sentry/utils/routeTitle';
import {useOrganization} from 'sentry/utils/useOrganization';
import {makeAlertsPathname} from 'sentry/views/alerts/pathnames';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {ProjectPermissionAlert} from 'sentry/views/settings/project/projectPermissionAlert';
import {useProjectAlertsOutlet} from 'sentry/views/settings/projectAlerts';

const alertSettingsSchema = z.object({
  subjectTemplate: z.string(),
  digestsMinDelay: z.number(),
  digestsMaxDelay: z.number(),
});

export default function ProjectAlertSettings() {
  const organization = useOrganization();
  const {canEditRule, project} = useProjectAlertsOutlet();

  const alertRulesTo = {
    pathname: makeAlertsPathname({path: '/rules/', organization}),
    query: {project: project?.id},
  };

  const projectMutationOptions = useUpdateProjectMutationOptions(project);

  // When the maximum delay is set below the minimum, the API rejects the save
  // with the error keyed under `digestsMinDelay`. The max field's form only
  // knows about `digestsMaxDelay`, so re-key the error onto it — that way
  // AutoSaveForm surfaces the message on the field the user just changed
  // instead of falling back to a generic "Failed to save".
  const maxDelayMutationOptions = {
    ...projectMutationOptions,
    mutationFn: (data: Partial<DetailedProject>) =>
      fetchMutation<DetailedProject>({
        method: 'PUT',
        url: `/projects/${organization.slug}/${project.slug}/`,
        data,
      }).catch((error: unknown) => {
        if (
          error instanceof RequestError &&
          error.responseJSON?.digestsMinDelay &&
          !error.responseJSON.digestsMaxDelay
        ) {
          error.responseJSON.digestsMaxDelay = error.responseJSON.digestsMinDelay;
        }
        throw error;
      }),
  };

  return (
    <FormSearch route="/settings/:orgId/projects/:projectId/alerts/">
      <SentryDocumentTitle
        title={routeTitleGen(t('Alerts Settings'), project.slug, false)}
      />
      <SettingsPageHeader title={t('Alerts Settings')} />
      <ProjectPermissionAlert project={project} />

      <Flex justify="end" paddingBottom="sm">
        <LinkButton to={alertRulesTo} size="sm">
          {t('View Alert Rules')}
        </LinkButton>
      </Flex>

      <FieldGroup title={t('Email Settings')}>
        <Alert variant="info" system>
          {tct(
            'Looking to fine-tune your personal notification preferences? Visit your [link:Account Settings].',
            {link: <Link to="/settings/account/notifications/" />}
          )}
        </Alert>

        <AutoSaveForm
          name="subjectTemplate"
          schema={alertSettingsSchema}
          initialValue={project.subjectTemplate}
          mutationOptions={projectMutationOptions}
        >
          {field => (
            <field.Layout.Row
              label={t('Subject Template')}
              hintText={t(
                'The email subject to use (excluding the prefix) for individual alerts. Usable variables include: $title, $shortID, $projectID, $orgID, and ${tag:key}, such as ${tag:environment} or ${tag:release}.'
              )}
            >
              <field.Input
                value={field.state.value}
                onChange={field.handleChange}
                placeholder="e.g. $shortID - $title"
                disabled={!canEditRule}
              />
            </field.Layout.Row>
          )}
        </AutoSaveForm>
      </FieldGroup>

      <FieldGroup title={t('Digests')}>
        <Alert variant="info" system>
          {t(
            'Sentry will automatically digest alerts sent by some services to avoid flooding your inbox with individual issue notifications. To control how frequently notifications are delivered, use the sliders below.'
          )}
        </Alert>

        <AutoSaveForm
          name="digestsMinDelay"
          schema={alertSettingsSchema}
          initialValue={project.digestsMinDelay}
          mutationOptions={projectMutationOptions}
        >
          {field => (
            <field.Layout.Row
              label={t('Minimum delivery interval')}
              hintText={t('Notifications will be delivered at most this often.')}
            >
              <field.Range
                aria-label={t('Minimum delivery interval')}
                value={field.state.value / 60}
                onChange={minutes => field.handleChange(minutes * 60)}
                min={1}
                max={60}
                step={1}
                formatOptions={{
                  style: 'unit',
                  unit: 'minute',
                  unitDisplay: 'long',
                }}
                disabled={!canEditRule}
              />
            </field.Layout.Row>
          )}
        </AutoSaveForm>

        <AutoSaveForm
          name="digestsMaxDelay"
          schema={alertSettingsSchema}
          initialValue={project.digestsMaxDelay}
          mutationOptions={maxDelayMutationOptions}
        >
          {field => (
            <field.Layout.Row
              label={t('Maximum delivery interval')}
              hintText={t('Notifications will be delivered at least this often.')}
            >
              <field.Range
                aria-label={t('Maximum delivery interval')}
                // The slider works in minutes so formatOptions can render the
                // value natively; the stored value stays in seconds.
                value={field.state.value / 60}
                onChange={minutes => field.handleChange(minutes * 60)}
                min={1}
                max={60}
                step={1}
                formatOptions={{
                  style: 'unit',
                  unit: 'minute',
                  unitDisplay: 'long',
                }}
                disabled={!canEditRule}
              />
            </field.Layout.Row>
          )}
        </AutoSaveForm>
      </FieldGroup>
    </FormSearch>
  );
}
