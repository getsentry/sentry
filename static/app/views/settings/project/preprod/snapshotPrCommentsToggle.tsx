import {Fragment} from 'react';
import {mutationOptions} from '@tanstack/react-query';
import {z} from 'zod';

import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {useDetailedProject} from 'sentry/utils/project/useDetailedProject';
import {useUpdateProject} from 'sentry/utils/project/useUpdateProject';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

import {getSnapshotPrComments} from './getSnapshotPrComments';

const schema = z.object({
  preprodSnapshotPrCommentsEnabled: z.boolean(),
  preprodSnapshotPrCommentsPostOnAdded: z.boolean(),
  preprodSnapshotPrCommentsPostOnRemoved: z.boolean(),
  preprodSnapshotPrCommentsPostOnChanged: z.boolean(),
  preprodSnapshotPrCommentsPostOnRenamed: z.boolean(),
});

type Schema = z.infer<typeof schema>;
type PrCommentField = {
  hintText: string;
  initialValue: boolean;
  label: string;
  name: keyof Schema;
};

export function SnapshotPrCommentsToggle() {
  const organization = useOrganization();
  const {project: outletProject} = useProjectSettingsOutlet();
  const {data: project = outletProject} = useDetailedProject({
    orgSlug: organization.slug,
    projectSlug: outletProject.slug,
  });
  const {mutateAsync: updateProject} = useUpdateProject(outletProject);
  const {enabled, postOnAdded, postOnRemoved, postOnChanged, postOnRenamed} =
    getSnapshotPrComments(project);

  const projectMutationOptions = mutationOptions({
    mutationFn: (data: Partial<Schema>) => updateProject(data),
  });

  const postConditionFields = [
    {
      name: 'preprodSnapshotPrCommentsPostOnChanged',
      initialValue: postOnChanged,
      label: t('Post on Changed Snapshots'),
      hintText: t('Include snapshots with pixel content changes in the PR comment.'),
    },
    {
      name: 'preprodSnapshotPrCommentsPostOnRemoved',
      initialValue: postOnRemoved,
      label: t('Post on Removed Snapshots'),
      hintText: t('Include removed snapshots in the PR comment.'),
    },
    {
      name: 'preprodSnapshotPrCommentsPostOnAdded',
      initialValue: postOnAdded,
      label: t('Post on Added Snapshots'),
      hintText: t('Include newly added snapshots in the PR comment.'),
    },
    {
      name: 'preprodSnapshotPrCommentsPostOnRenamed',
      initialValue: postOnRenamed,
      label: t('Post on Renamed Snapshots'),
      hintText: t('Include renamed snapshots in the PR comment.'),
    },
  ] satisfies PrCommentField[];

  return (
    <FieldGroup title={t('Snapshots - Pull Request Comments')}>
      <AutoSaveForm
        name="preprodSnapshotPrCommentsEnabled"
        schema={schema}
        initialValue={enabled}
        mutationOptions={projectMutationOptions}
      >
        {field => (
          <field.Layout.Row
            label={t('Enable Snapshot PR Comments')}
            hintText={t(
              'Sentry will post snapshot comparison results as comments on pull requests.'
            )}
          >
            <field.Switch checked={field.state.value} onChange={field.handleChange} />
          </field.Layout.Row>
        )}
      </AutoSaveForm>

      {enabled ? (
        <Fragment>
          {postConditionFields.map(({name, initialValue, label, hintText}) => (
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
            {t('Enable PR comments to configure post conditions')}
          </Text>
        </Container>
      )}
    </FieldGroup>
  );
}
