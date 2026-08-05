import {z} from 'zod';

import {LinkButton} from '@sentry/scraps/button';
import {AutoSaveForm, FieldGroup} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';

import Feature from 'sentry/components/acl/feature';
import {t} from 'sentry/locale';
import type {DetailedProject} from 'sentry/types/project';

import {useSamplingPriorityMutationOptions} from './useSamplingPriorityMutationOptions';

type SamplingPrioritiesSectionProps = {
  hasWriteAccess: boolean;
  project: DetailedProject;
};

export function SamplingPrioritiesSection({
  hasWriteAccess,
  project,
}: SamplingPrioritiesSectionProps) {
  const {
    getMutationOptions,
    isPriorityActive,
    isUpdatingSamplingPriority,
    priorityFields,
  } = useSamplingPriorityMutationOptions(project);

  return (
    <Feature features="organizations:dynamic-sampling">
      <FieldGroup title={t('Sampling Priorities')}>
        {priorityFields.map(priority => (
          <AutoSaveForm
            key={priority.name}
            name={priority.name}
            schema={z.object({[priority.name]: z.boolean()})}
            initialValue={isPriorityActive(priority.name)}
            mutationOptions={getMutationOptions(priority.name)}
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
