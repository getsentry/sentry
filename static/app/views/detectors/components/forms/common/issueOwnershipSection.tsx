import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Stack} from '@sentry/scraps/layout';

import {SentryMemberTeamSelectorField} from 'sentry/components/forms/fields/sentryMemberTeamSelectorField';
import {TextareaField} from 'sentry/components/forms/fields/textareaField';
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
          <MinHeightTextarea
            name="description"
            label={t('Describe')}
            help={t(
              'Add any additional context about this monitor for other team members.'
            )}
            stacked
            inline={false}
            aria-label={t('description')}
            placeholder={t(
              'Example monitor description\n\nTo debug follow these steps:\n1. \u2026\n2. \u2026\n3. \u2026'
            )}
            rows={6}
            autosize
          />
        </Stack>
      </FormSection>
    </Container>
  );
}

const OwnershipField = styled(SentryMemberTeamSelectorField)`
  padding: ${p => p.theme.space.lg} 0;
`;

// Min height helps prevent resize after placeholder is replaced with user input
const MinHeightTextarea = styled(TextareaField)`
  padding: ${p => p.theme.space.lg} 0;
  textarea {
    min-height: 140px;
  }
`;
