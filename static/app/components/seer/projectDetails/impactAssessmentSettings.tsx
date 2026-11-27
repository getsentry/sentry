import {z} from 'zod';

import {FeatureBadge} from '@sentry/scraps/badge';
import {AutoSaveForm, FieldGroup, FormSearch} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {t} from 'sentry/locale';
import type {DetailedProject} from 'sentry/types/project';
import {useUpdateProjectMutationOptions} from 'sentry/utils/project/useUpdateProject';

const impactAssessmentSettingsSchema = z.object({
  impactAssessmentProjectContext: z.string().trim().max(4000),
});

interface Props {
  canWrite: boolean;
  project: DetailedProject;
}

export function ImpactAssessmentSettings({canWrite, project}: Props) {
  const projectMutationOptions = useUpdateProjectMutationOptions(project);

  return (
    <FormSearch route="/settings/:orgId/projects/:projectId/seer">
      <FieldGroup>
        <AutoSaveForm
          name="impactAssessmentProjectContext"
          schema={impactAssessmentSettingsSchema}
          initialValue={project.impactAssessmentProjectContext ?? ''}
          mutationOptions={projectMutationOptions}
        >
          {field => (
            <field.Layout.Row
              label={
                <Flex align="center" gap="sm">
                  <Text>{t('Guidance for Assessing Impact')}</Text>
                  <FeatureBadge type="alpha" />
                </Flex>
              }
              hintText={t(
                "Impact Assessment estimates how an issue affects an end user's ability to use your product. Describe your project and the workflows it supports to guide more accurate results."
              )}
            >
              <field.TextArea
                value={field.state.value}
                onChange={field.handleChange}
                placeholder={t(
                  'This is an internal web app used by our support team, not customers, to look up accounts, issue refunds, and resolve tickets.'
                )}
                rows={2}
                disabled={!canWrite}
              />
            </field.Layout.Row>
          )}
        </AutoSaveForm>
      </FieldGroup>
    </FormSearch>
  );
}
