import {useMemo} from 'react';
import styled from '@emotion/styled';

import SentryMemberTeamSelectorField from 'sentry/components/forms/fields/sentryMemberTeamSelectorField';
import {t} from 'sentry/locale';
import useProjects from 'sentry/utils/useProjects';
import {METRIC_DETECTOR_FORM_FIELDS} from 'sentry/views/detectors/components/forms/metricFormData';

type AssigneeFieldProps = {
  projectId: string;
};

export function AssigneeField({projectId}: AssigneeFieldProps) {
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
      name={METRIC_DETECTOR_FORM_FIELDS.owner}
      flexibleControlStateSize
      memberOfProjectSlugs={memberOfProjectSlugs}
    />
  );
}

const StyledMemberTeamSelectorField = styled(SentryMemberTeamSelectorField)`
  padding-left: 0;
`;
