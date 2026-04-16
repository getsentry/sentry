import styled from '@emotion/styled';

import {SentryProjectSelectorField} from 'sentry/components/forms/fields/sentryProjectSelectorField';
import {t} from 'sentry/locale';
import {useProjects} from 'sentry/utils/useProjects';
import {useDetectorFormProject} from 'sentry/views/detectors/components/forms/common/useDetectorFormProject';
import {useDetectorFormContext} from 'sentry/views/detectors/components/forms/context';
import {useCanEditDetector} from 'sentry/views/detectors/utils/useCanEditDetector';

export function ProjectField() {
  const {projects, fetching} = useProjects();
  const {detectorType} = useDetectorFormContext();
  const project = useDetectorFormProject();
  const canEditDetector = useCanEditDetector({projectId: project.id, detectorType});

  return (
    <StyledProjectField
      inline={false}
      flexibleControlStateSize
      stacked
      projects={projects}
      groupProjects={p => (p.isMember ? 'member' : 'all')}
      groups={[
        {key: 'member', label: t('My Projects')},
        {key: 'all', label: t('All Projects')},
      ]}
      name="projectId"
      label={t('Project')}
      placeholder={t('Project')}
      aria-label={t('Select Project')}
      disabled={fetching}
      size="sm"
      required
      validate={() => {
        if (!canEditDetector) {
          return [
            [
              'projectId',
              t('You do not have permission to create or edit monitors in this project'),
            ],
          ];
        }
        return [];
      }}
    />
  );
}

const StyledProjectField = styled(SentryProjectSelectorField)`
  flex-grow: 1;
  max-width: 260px;
  padding: 0;
`;
