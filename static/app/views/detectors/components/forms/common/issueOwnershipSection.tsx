import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';

import {SentryMemberTeamSelectorField} from 'sentry/components/forms/fields/sentryMemberTeamSelectorField';
import {FormField} from 'sentry/components/forms/formField';
import {MarkdownTextArea} from 'sentry/components/markdownTextArea';
import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import {FormSection} from 'sentry/components/workflowEngine/ui/formSection';
import {t} from 'sentry/locale';
import {useProjects} from 'sentry/utils/useProjects';

export function IssueOwnershipSection({step}: {step?: number}) {
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

const OwnershipField = styled(SentryMemberTeamSelectorField)`
  padding: ${p => p.theme.space.lg} 0;
`;

const DescriptionField = styled(FormField)`
  padding: ${p => p.theme.space.lg} 0;
`;
