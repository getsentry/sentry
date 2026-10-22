import styled from '@emotion/styled';

import {SentryProjectSelectorField} from 'sentry/components/forms/fields/sentryProjectSelectorField';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useDetectorFormProject} from 'sentry/views/detectors/components/forms/common/useDetectorFormProject';
import {useDetectorFormContext} from 'sentry/views/detectors/components/forms/context';
import {hasDetectorWriteAccess} from 'sentry/views/detectors/utils/permissions';
import {useCanEditDetector} from 'sentry/views/detectors/utils/useCanEditDetector';

export function ProjectField() {
  const organization = useOrganization();
  const {projects, fetching} = useProjects();
  const {detectorType, detector} = useDetectorFormContext();
  const project = useDetectorFormProject();
  const canEditDetector = useCanEditDetector({projectId: project.id, detectorType});
  const isEditing = !!detector;
  const selectableProjects = isEditing
    ? projects
    : projects.filter(candidate =>
        hasDetectorWriteAccess({organization, project: candidate})
      );

  return (
    <StyledProjectField
      inline={false}
      flexibleControlStateSize
      stacked
      projects={selectableProjects}
      groupProjects={p => (p.isMember ? 'member' : 'all')}
      groups={[
        {key: 'member', label: t('My Projects')},
        {key: 'all', label: t('All Projects')},
      ]}
      name="projectId"
      label={t('Project')}
      placeholder={t('Project')}
      aria-label={t('Select Project')}
      disabled={fetching || isEditing}
      disabledReason={
        isEditing
          ? t("A monitor's project can't be changed after it's been created.")
          : undefined
      }
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
