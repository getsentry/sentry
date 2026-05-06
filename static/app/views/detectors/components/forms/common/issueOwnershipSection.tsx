import {useMemo} from 'react';
import styled from '@emotion/styled';

import {withFieldGroup} from '@sentry/scraps/form';
import {Stack} from '@sentry/scraps/layout';

import {SentryMemberTeamSelectorField} from 'sentry/components/forms/fields/sentryMemberTeamSelectorField';
import {FormField} from 'sentry/components/forms/formField';
import {MarkdownTextArea} from 'sentry/components/markdownTextArea';
import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import {FormSection} from 'sentry/components/workflowEngine/ui/formSection';
import {t} from 'sentry/locale';
import {useOwnerOptions} from 'sentry/utils/useOwnerOptions';
import {useOwners} from 'sentry/utils/useOwners';
import {useProjects} from 'sentry/utils/useProjects';

/**
 * Legacy version for forms using FormModel/FormContext.
 * Remove once all detector forms have migrated to the new form system.
 */
export function IssueOwnershipSectionDeprecated({step}: {step?: number}) {
  const projectId = useFormField<string>('projectId');
  const {projects} = useProjects();
  const memberOfProjectSlugs = useMemo(() => {
    const project = projects.find(p => p.id === projectId);
    return project ? [project.slug] : undefined;
  }, [projects, projectId]);

  return (
    <Container>
      <FormSection step={step} title={t('Issue Ownership')}>
        <Stack>
          <OwnershipField
            placeholder={t('Select a member or team')}
            label={t('Assign')}
            help={t(
              'Sentry will assign issues detected by this monitor to this individual or team.'
            )}
            name="owner"
            flexibleControlStateSize
            memberOfProjectSlugs={memberOfProjectSlugs}
          />
          <DescriptionField
            name="description"
            label={t('Describe')}
            hideControlState
            flexibleControlStateSize
            help={t(
              'Add any additional context about this monitor for other team members.'
            )}
            stacked
            inline={false}
          >
            {fieldProps => (
              <MarkdownTextArea
                {...fieldProps}
                aria-label={t('description')}
                placeholder={t(
                  'Example monitor description\n\nTo debug follow these steps:\n1. \u2026\n2. \u2026\n3. \u2026'
                )}
              />
            )}
          </DescriptionField>
        </Stack>
      </FormSection>
    </Container>
  );
}

export const IssueOwnershipSection = withFieldGroup({
  defaultValues: {owner: null as string | null, description: null as string | null},
  props: {} as {projectId: string; step?: number},
  render: ({group, step, projectId}) => (
    <Container>
      <FormSection step={step} title={t('Issue Ownership')}>
        <Stack gap="md">
          <group.AppField name="owner">
            {field => <OwnerSelectField field={field} projectId={projectId} />}
          </group.AppField>
          <group.AppField name="description">
            {field => (
              <field.Layout.Stack
                label={t('Describe')}
                hintText={t(
                  'Add any additional context about this monitor for other team members.'
                )}
              >
                <MarkdownTextArea
                  value={field.state.value ?? ''}
                  onChange={val => field.handleChange(val.target.value)}
                  aria-label={t('description')}
                  placeholder={t(
                    'Example monitor description\n\nTo debug follow these steps:\n1. \u2026\n2. \u2026\n3. \u2026'
                  )}
                />
              </field.Layout.Stack>
            )}
          </group.AppField>
        </Stack>
      </FormSection>
    </Container>
  ),
});

function OwnerSelectField({field, projectId}: {field: any; projectId: string}) {
  const {projects} = useProjects();
  const memberOfProjectSlugs = useMemo(() => {
    const project = projects.find(p => p.id === projectId);
    return project ? [project.slug] : undefined;
  }, [projects, projectId]);

  const currentValue = useMemo(
    () => (field.state.value ? [field.state.value] : undefined),
    [field.state.value]
  );

  const {teams, members, fetching, onTeamSearch, onMemberSearch} = useOwners({
    currentValue,
  });
  const options = useOwnerOptions({
    teams,
    members,
    avatarProps: {size: 20},
    memberOfProjectSlugs,
  });

  return (
    <field.Layout.Row
      label={t('Assign')}
      hintText={t(
        'Sentry will assign issues detected by this monitor to this individual or team.'
      )}
    >
      <field.Select
        value={field.state.value}
        onChange={field.handleChange}
        options={options}
        clearable
        placeholder={t('Select a member or team')}
        isLoading={fetching}
        onInputChange={(value: string) => {
          onMemberSearch(value);
          onTeamSearch(value);
        }}
      />
    </field.Layout.Row>
  );
}

const OwnershipField = styled(SentryMemberTeamSelectorField)`
  padding: ${p => p.theme.space.lg} 0;
`;

const DescriptionField = styled(FormField)`
  padding: ${p => p.theme.space.lg} 0;
`;
