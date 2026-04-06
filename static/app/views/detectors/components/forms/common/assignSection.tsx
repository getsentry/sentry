import {useMemo} from 'react';
import styled from '@emotion/styled';

import {SentryMemberTeamSelectorField} from 'sentry/components/forms/fields/sentryMemberTeamSelectorField';
import {useFormField} from 'sentry/components/workflowEngine/form/useFormField';
import {Container} from 'sentry/components/workflowEngine/ui/container';
import {FormSection} from 'sentry/components/workflowEngine/ui/formSection';
import {t} from 'sentry/locale';
import {useProjects} from 'sentry/utils/useProjects';

function AssigneeField({projectId}: {projectId?: string}) {
  const {projects} = useProjects();
  const memberOfProjectSlugs = useMemo(() => {
    const project = projects.find(p => p.id === projectId);
    return project ? [project.slug] : undefined;
  }, [projects, projectId]);

  return (
    <StyledMemberTeamSelectorField
      placeholder={t('Select a member or team')}
      label={t('Default assignee')}
      help={t('Sentry will assign new issues to this assignee.')}
      name="owner"
      flexibleControlStateSize
      memberOfProjectSlugs={memberOfProjectSlugs}
    />
  );
}

export function AssignSection({step}: {step?: number}) {
  const projectId = useFormField<string>('projectId');

  return (
    <Container>
      <FormSection step={step} title={t('Assign')}>
        <AssigneeField projectId={projectId} />
      </FormSection>
    </Container>
  );
}

const StyledMemberTeamSelectorField = styled(SentryMemberTeamSelectorField)`
  padding: 0;
`;
