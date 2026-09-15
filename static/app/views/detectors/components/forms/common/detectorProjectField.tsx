import {ProjectAvatar} from '@sentry/scraps/avatar';
import {withFieldGroup} from '@sentry/scraps/form';
import {Container as LayoutContainer} from '@sentry/scraps/layout';
import {Select} from '@sentry/scraps/select';

import {t} from 'sentry/locale';
import type {Detector, DetectorType} from 'sentry/types/workflowEngine/detectors';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {canEditDetector} from 'sentry/views/detectors/utils/useCanEditDetector';

export interface DetectorProjectFieldProps {
  detectorType: DetectorType;
  detector?: Detector;
}

export const DetectorProjectField = withFieldGroup({
  defaultValues: {projectId: ''},
  props: {} as DetectorProjectFieldProps,
  render: function DetectorProjectField({group, detectorType, detector}) {
    const {projects, fetching} = useProjects();
    const organization = useOrganization();
    const validatePermission = ({value}: {value: string}) =>
      canEditDetector({
        organization,
        detectorType,
        project: projects.find(project => project.id === value),
      })
        ? undefined
        : {
            message: t(
              'You do not have permission to create or edit monitors in this project'
            ),
          };
    const options = ['member', 'all'].map(key => ({
      label: key === 'member' ? t('My Projects') : t('All Projects'),
      options: projects
        .filter(project => (project.isMember ? 'member' : 'all') === key)
        .map(project => ({
          value: project.id,
          label: project.slug,
          leadingItems: <ProjectAvatar project={project} size={20} />,
        })),
    }));
    return (
      <LayoutContainer flex={1} maxWidth="260px">
        <group.AppField
          name="projectId"
          validators={{
            onChange: validatePermission,
            onSubmit: validatePermission,
          }}
        >
          {field => (
            <field.Layout.Stack label={t('Project')} required>
              <field.Base
                disabled={
                  detector
                    ? t("A monitor's project can't be changed after it's been created.")
                    : fetching
                }
              >
                {({ref: _ref, id, ...baseProps}) => (
                  <LayoutContainer flex={1} minWidth={0}>
                    <Select
                      {...baseProps}
                      inputId={id}
                      value={field.state.value}
                      onChange={option => field.handleChange(option.value)}
                      options={options}
                      placeholder={t('Project')}
                      aria-label={t('Select Project')}
                      size="sm"
                    />
                  </LayoutContainer>
                )}
              </field.Base>
            </field.Layout.Stack>
          )}
        </group.AppField>
      </LayoutContainer>
    );
  },
});
