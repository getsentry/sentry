import {z} from 'zod';

import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';

import {t} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Project} from 'sentry/types/project';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

import {useSnapshotStatusChecks} from './useSnapshotStatusChecks';

const schema = z.object({
  preprodSnapshotStatusChecksEnabled: z.boolean(),
  preprodSnapshotStatusChecksFailOnAdded: z.boolean(),
  preprodSnapshotStatusChecksFailOnRemoved: z.boolean(),
  preprodSnapshotStatusChecksFailOnChanged: z.boolean(),
  preprodSnapshotStatusChecksFailOnRenamed: z.boolean(),
});

type Schema = z.infer<typeof schema>;

export function SnapshotStatusChecks() {
  const organization = useOrganization();
  const {project} = useProjectSettingsOutlet();
  const {enabled, failOnAdded, failOnRemoved, failOnChanged, failOnRenamed} =
    useSnapshotStatusChecks(project);

  const projectEndpoint = `/projects/${organization.slug}/${project.slug}/`;

  const mutationOptions = {
    mutationFn: (data: Partial<Schema>) =>
      fetchMutation<Project>({
        url: projectEndpoint,
        method: 'PUT',
        data,
      }),
    onSuccess: (response: Project) => ProjectsStore.onUpdateSuccess(response),
  };

  const disabledHint = enabled
    ? false
    : t('Enable Snapshot Status Checks above to configure.');

  return (
    <FieldGroup title={t('Snapshots - Status Checks')}>
      <AutoSaveForm
        name="preprodSnapshotStatusChecksEnabled"
        schema={schema}
        initialValue={enabled}
        mutationOptions={mutationOptions}
      >
        {field => (
          <field.Layout.Row
            label={t('Enable Snapshot Status Checks')}
            hintText={t(
              'Sentry will post status checks based on snapshot changes in your builds.'
            )}
          >
            <field.Switch checked={field.state.value} onChange={field.handleChange} />
          </field.Layout.Row>
        )}
      </AutoSaveForm>

      <AutoSaveForm
        name="preprodSnapshotStatusChecksFailOnChanged"
        schema={schema}
        initialValue={failOnChanged}
        mutationOptions={mutationOptions}
      >
        {field => (
          <field.Layout.Row
            label={t('Fail on Changed Snapshots')}
            hintText={t(
              'Status check will fail if snapshot pixel content changes in a build.'
            )}
          >
            <field.Switch
              checked={enabled ? field.state.value : false}
              onChange={field.handleChange}
              disabled={disabledHint}
            />
          </field.Layout.Row>
        )}
      </AutoSaveForm>

      <AutoSaveForm
        name="preprodSnapshotStatusChecksFailOnRemoved"
        schema={schema}
        initialValue={failOnRemoved}
        mutationOptions={mutationOptions}
      >
        {field => (
          <field.Layout.Row
            label={t('Fail on Removed Snapshots')}
            hintText={t('Status check will fail if snapshots are removed from a build.')}
          >
            <field.Switch
              checked={enabled ? field.state.value : false}
              onChange={field.handleChange}
              disabled={disabledHint}
            />
          </field.Layout.Row>
        )}
      </AutoSaveForm>

      <AutoSaveForm
        name="preprodSnapshotStatusChecksFailOnAdded"
        schema={schema}
        initialValue={failOnAdded}
        mutationOptions={mutationOptions}
      >
        {field => (
          <field.Layout.Row
            label={t('Fail on Added Snapshots')}
            hintText={t('Status check will fail if new snapshots are added in a build.')}
          >
            <field.Switch
              checked={enabled ? field.state.value : false}
              onChange={field.handleChange}
              disabled={disabledHint}
            />
          </field.Layout.Row>
        )}
      </AutoSaveForm>

      <AutoSaveForm
        name="preprodSnapshotStatusChecksFailOnRenamed"
        schema={schema}
        initialValue={failOnRenamed}
        mutationOptions={mutationOptions}
      >
        {field => (
          <field.Layout.Row
            label={t('Fail on Renamed Snapshots')}
            hintText={t('Status check will fail if snapshots are renamed in a build.')}
          >
            <field.Switch
              checked={enabled ? field.state.value : false}
              onChange={field.handleChange}
              disabled={disabledHint}
            />
          </field.Layout.Row>
        )}
      </AutoSaveForm>
    </FieldGroup>
  );
}
