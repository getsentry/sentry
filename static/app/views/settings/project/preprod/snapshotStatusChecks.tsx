import {Fragment} from 'react';
import {mutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Project} from 'sentry/types/project';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectFromId} from 'sentry/utils/useProjectFromId';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

import {getSnapshotStatusChecks} from './getSnapshotStatusChecks';

const schema = z.object({
  preprodSnapshotStatusChecksEnabled: z.boolean(),
  preprodSnapshotStatusChecksFailOnAdded: z.boolean(),
  preprodSnapshotStatusChecksFailOnRemoved: z.boolean(),
  preprodSnapshotStatusChecksFailOnChanged: z.boolean(),
  preprodSnapshotStatusChecksFailOnRenamed: z.boolean(),
});

type Schema = z.infer<typeof schema>;
type SnapshotStatusCheckField = {
  hintText: string;
  initialValue: boolean;
  label: string;
  name: keyof Schema;
};

export function SnapshotStatusChecks() {
  const organization = useOrganization();
  const {project: outletProject} = useProjectSettingsOutlet();
  const project = useProjectFromId({project_id: outletProject.id}) ?? outletProject;
  const {enabled, failOnAdded, failOnRemoved, failOnChanged, failOnRenamed} =
    getSnapshotStatusChecks(project);

  const projectEndpoint = `/projects/${organization.slug}/${project.slug}/`;

  const projectMutationOptions = mutationOptions({
    mutationFn: (data: Partial<Schema>) =>
      fetchMutation<Project>({
        url: projectEndpoint,
        method: 'PUT',
        data,
      }),
    onMutate: data => {
      const previous = ProjectsStore.getById(project.id);
      ProjectsStore.onUpdateSuccess({id: project.id, ...data});
      return () => {
        if (previous) {
          ProjectsStore.onUpdateSuccess(previous);
        }
      };
    },
    onSuccess: response => ProjectsStore.onUpdateSuccess(response),
    onError: (_error, _variables, rollback) => {
      rollback?.();
    },
  });

  const failureConditionFields = [
    {
      name: 'preprodSnapshotStatusChecksFailOnChanged',
      initialValue: failOnChanged,
      label: t('Fail on Changed Snapshots'),
      hintText: t('Status check will fail if snapshot pixel content changes in a build.'),
    },
    {
      name: 'preprodSnapshotStatusChecksFailOnRemoved',
      initialValue: failOnRemoved,
      label: t('Fail on Removed Snapshots'),
      hintText: t('Status check will fail if snapshots are removed from a build.'),
    },
    {
      name: 'preprodSnapshotStatusChecksFailOnAdded',
      initialValue: failOnAdded,
      label: t('Fail on Added Snapshots'),
      hintText: t('Status check will fail if new snapshots are added in a build.'),
    },
    {
      name: 'preprodSnapshotStatusChecksFailOnRenamed',
      initialValue: failOnRenamed,
      label: t('Fail on Renamed Snapshots'),
      hintText: t('Status check will fail if snapshots are renamed in a build.'),
    },
  ] satisfies SnapshotStatusCheckField[];

  return (
    <FieldGroup title={t('Snapshots - Status Checks')}>
      <AutoSaveForm
        name="preprodSnapshotStatusChecksEnabled"
        schema={schema}
        initialValue={enabled}
        mutationOptions={projectMutationOptions}
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

      {enabled ? (
        <Fragment>
          {failureConditionFields.map(({name, initialValue, label, hintText}) => (
            <AutoSaveForm
              key={name}
              name={name}
              schema={schema}
              initialValue={initialValue}
              mutationOptions={projectMutationOptions}
            >
              {field => (
                <field.Layout.Row label={label} hintText={hintText}>
                  <field.Switch
                    checked={field.state.value}
                    onChange={field.handleChange}
                  />
                </field.Layout.Row>
              )}
            </AutoSaveForm>
          ))}
        </Fragment>
      ) : (
        <Container padding="md">
          <Text align="center" variant="muted" italic>
            {t('Enable status checks to configure failure conditions')}
          </Text>
        </Container>
      )}
    </FieldGroup>
  );
}
