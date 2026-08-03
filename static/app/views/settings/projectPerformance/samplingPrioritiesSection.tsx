import {useIsMutating, useQueryClient} from '@tanstack/react-query';
import {z} from 'zod';

import {LinkButton} from '@sentry/scraps/button';
import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';

import Feature from 'sentry/components/acl/feature';
import {t} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {DetailedProject} from 'sentry/types/project';
import {DynamicSamplingBiasType} from 'sentry/types/sampling';
import {trackAnalytics} from 'sentry/utils/analytics';
import {makeDetailedProjectQueryKey} from 'sentry/utils/project/useDetailedProject';
import {fetchMutation} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

import {getRetentionPriorityFields} from './detectorSettings';

export function SamplingPrioritiesSection({
  hasWriteAccess,
  project,
}: {
  hasWriteAccess: boolean;
  project: DetailedProject;
}) {
  const organization = useOrganization();
  const {projectId: projectSlug} = useParams<{projectId: string}>();
  const queryClient = useQueryClient();
  const endpoint = `/projects/${organization.slug}/${projectSlug}/`;
  const priorityFields = getRetentionPriorityFields(organization);
  const projectQueryKey = makeDetailedProjectQueryKey({
    orgSlug: organization.slug,
    projectSlug,
  });
  const mutationKey = ['project-sampling-priorities', project.id];
  const isUpdatingSamplingPriority = useIsMutating({mutationKey}) > 0;

  const isPriorityActive = (name: DynamicSamplingBiasType) =>
    project.dynamicSamplingBiases?.find(bias => bias.id === name)?.active ?? false;

  return (
    <Feature features="organizations:dynamic-sampling">
      <FieldGroup title={t('Sampling Priorities')}>
        {priorityFields.map(priority => (
          <AutoSaveForm
            key={`${priority.name}-${isPriorityActive(priority.name)}`}
            name={priority.name}
            schema={z.object({[priority.name]: z.boolean()})}
            initialValue={isPriorityActive(priority.name)}
            mutationOptions={{
              mutationKey,
              mutationFn: (data: Record<string, boolean>) =>
                fetchMutation<DetailedProject>({
                  url: endpoint,
                  method: 'PUT',
                  data: {
                    dynamicSamplingBiases: priorityFields.map(({name}) => ({
                      id: name,
                      active:
                        name === priority.name
                          ? (data[priority.name] ?? false)
                          : isPriorityActive(name),
                    })),
                  },
                }),
              onSuccess: (response, variables) => {
                ProjectsStore.onUpdateSuccess(response);
                queryClient.setQueryData(projectQueryKey, previous => ({
                  json: response,
                  headers: previous?.headers ?? {},
                }));
                trackAnalytics(
                  variables[priority.name]
                    ? 'dynamic_sampling_settings.priority_enabled'
                    : 'dynamic_sampling_settings.priority_disabled',
                  {organization, project_id: project.id, id: priority.name}
                );
              },
            }}
          >
            {field => (
              <field.Layout.Row label={priority.label} hintText={priority.hintText}>
                <field.Switch
                  checked={field.state.value}
                  onChange={field.handleChange}
                  disabled={!hasWriteAccess || isUpdatingSamplingPriority}
                />
              </field.Layout.Row>
            )}
          </AutoSaveForm>
        ))}
        <Flex justify="end">
          <LinkButton
            external
            href="https://docs.sentry.io/product/performance/performance-at-scale/"
          >
            {t('Read docs')}
          </LinkButton>
        </Flex>
      </FieldGroup>
    </Feature>
  );
}
