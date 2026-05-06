import {useMemo} from 'react';
import styled from '@emotion/styled';

import {withFieldGroup} from '@sentry/scraps/form';
import {Container} from '@sentry/scraps/layout';

import {hasEveryAccess} from 'sentry/components/acl/access';
import {SentryProjectSelectorField} from 'sentry/components/forms/fields/sentryProjectSelectorField';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useDetectorFormProject} from 'sentry/views/detectors/components/forms/common/useDetectorFormProject';
import {useDetectorFormContext} from 'sentry/views/detectors/components/forms/context';
import {detectorTypeIsUserCreateable} from 'sentry/views/detectors/utils/detectorTypeConfig';
import {useCanEditDetector} from 'sentry/views/detectors/utils/useCanEditDetector';

export function ProjectSelectFieldDeprecated() {
  const {projects, fetching} = useProjects();
  const {detectorType, detector} = useDetectorFormContext();
  const project = useDetectorFormProject();
  const canEditDetector = useCanEditDetector({projectId: project.id, detectorType});
  const isEditing = !!detector;

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
      disabled={fetching || isEditing}
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

export function useProjectFieldValidators() {
  const organization = useOrganization();
  const {projects} = useProjects();
  const {detectorType} = useDetectorFormContext();

  return useMemo(
    () => ({
      onChange: ({value}: {value: string}) => {
        const project = projects.find(p => p.id === value);
        if (!project) {
          return;
        }
        const canEdit = detectorTypeIsUserCreateable(detectorType)
          ? hasEveryAccess(['alerts:write'], {organization, project})
          : project.access.includes('alerts:write');
        if (!canEdit) {
          return t(
            'You do not have permission to create or edit monitors in this project'
          );
        }
        return;
      },
    }),
    [organization, projects, detectorType]
  );
}

export const ProjectField = withFieldGroup({
  defaultValues: {projectId: ''},
  props: {},
  render: function ProjectFieldContent({group}) {
    const validators = useProjectFieldValidators();
    const {projects, fetching} = useProjects();
    const {detector} = useDetectorFormContext();
    const isEditing = !!detector;

    const options = useMemo(() => {
      const memberProjects = projects.filter(p => p.isMember);
      const otherProjects = projects.filter(p => !p.isMember);
      return [
        ...memberProjects.map(p => ({value: p.id, label: p.slug})),
        ...otherProjects.map(p => ({value: p.id, label: p.slug})),
      ];
    }, [projects]);

    return (
      <group.AppField name="projectId" validators={validators}>
        {field => (
          <field.Layout.Stack label={t('Project')} required>
            <Container maxWidth="260px">
              <field.Select
                value={field.state.value}
                onChange={field.handleChange}
                options={options}
                disabled={fetching || isEditing}
                placeholder={t('Select a project')}
              />
            </Container>
          </field.Layout.Stack>
        )}
      </group.AppField>
    );
  },
});

const StyledProjectField = styled(SentryProjectSelectorField)`
  flex-grow: 1;
  max-width: 260px;
  padding: 0;
`;
