import {Fragment, useEffect, useState} from 'react';
import {z} from 'zod';

import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {Project} from 'sentry/types/project';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectSettingsOutlet} from 'sentry/views/settings/project/projectSettingsLayout';

import {useSnapshotPrComments} from './useSnapshotPrComments';

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
  const {project} = useProjectSettingsOutlet();
  const {enabled, postOnAdded, postOnRemoved, postOnChanged, postOnRenamed} =
    useSnapshotPrComments(project);
  const [prCommentsEnabled, setPrCommentsEnabled] = useState(enabled);

  const projectEndpoint = `/projects/${organization.slug}/${project.slug}/`;

  useEffect(() => {
    setPrCommentsEnabled(enabled);
  }, [enabled]);

  const mutationOptions = {
    mutationFn: (data: Partial<Schema>) =>
      fetchMutation<Project>({
        url: projectEndpoint,
        method: 'PUT',
        data,
      }),
    onSuccess: (response: Project) => ProjectsStore.onUpdateSuccess(response),
  };

  const enabledMutationOptions = {
    ...mutationOptions,
    onError: () => setPrCommentsEnabled(enabled),
  };

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
        mutationOptions={enabledMutationOptions}
      >
        {field => (
          <field.Layout.Row
            label={t('Enable Snapshot PR Comments')}
            hintText={t(
              'Sentry will post snapshot comparison results as comments on pull requests.'
            )}
          >
            <field.Switch
              checked={field.state.value}
              onChange={value => {
                setPrCommentsEnabled(value);
                field.handleChange(value);
              }}
            />
          </field.Layout.Row>
        )}
      </AutoSaveForm>

      {prCommentsEnabled ? (
        <Fragment>
          {postConditionFields.map(({name, initialValue, label, hintText}) => (
            <AutoSaveForm
              key={name}
              name={name}
              schema={schema}
              initialValue={initialValue}
              mutationOptions={mutationOptions}
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
