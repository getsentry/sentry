import {Flex} from 'sentry/components/core/layout';
import {components} from 'sentry/components/forms/controls/reactSelectWrapper';
import IdBadge from 'sentry/components/idBadge';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';

// XXX(epurkhiser): This is wrong, it should not be inheriting these props
import type {InputFieldProps} from './inputField';
import SelectField from './selectField';

const OVERRIDE_COMPONENTS = {
  MultiValueLabel: SelectedProjectMultiValueLabel,
};

/**
 * Function used to group projects by returning the key of the group
 */
type GroupProjects = (project: Project) => string;

// projects can be passed as a direct prop as well
export interface RenderFieldProps extends InputFieldProps {
  avatarSize?: number;
  /**
   * Controls grouping of projects within the field. Useful to prioritize some
   * projects above others
   */
  groupProjects?: GroupProjects;
  /**
   * When using groupProjects you must specify the labels of the groups as a
   * list of key and label. The ordering determines the order of the groups.
   */
  groups?: Array<{key: string; label: React.ReactNode}>;
  projects?: Project[];
  /**
   * Use the slug as the select field value. Without setting this the numeric id
   * of the project will be used.
   */
  valueIsSlug?: boolean;
}

// When in multi-select mode, this adds the project badget to the selected badges
function SelectedProjectMultiValueLabel({
  data,
  children,
  ...props
}: React.ComponentProps<typeof components.MultiValueLabel>) {
  return (
    <components.MultiValueLabel data={data} {...props}>
      <Flex align="center" gap="xs">
        {data.project ? (
          <IdBadge
            project={data.project}
            avatarSize={14}
            avatarProps={{consistentWidth: true}}
            hideName
          />
        ) : null}
        {children}
      </Flex>
    </components.MultiValueLabel>
  );
}

function SentryProjectSelectorField({
  projects,
  groupProjects,
  groups,
  avatarSize = 20,
  placeholder = t('Choose Sentry project'),
  valueIsSlug,
  ...props
}: RenderFieldProps) {
  function projectToOption(project: Project) {
    return {
      value: project[valueIsSlug ? 'slug' : 'id'],
      label: project.slug,
      project,
      leadingItems: (
        <IdBadge
          project={project}
          avatarSize={avatarSize}
          avatarProps={{consistentWidth: true}}
          hideName
        />
      ),
    };
  }

  const projectOptions =
    projects && groupProjects
      ? // Create project groups when groupProjects is in use
        groups?.map(({key, label}) => ({
          label,
          options: projects
            .filter(project => groupProjects(project) === key)
            .map(projectToOption),
        }))
      : // Otherwise just map projects to the options
        projects?.map(projectToOption);

  return (
    <SelectField
      placeholder={placeholder}
      options={projectOptions}
      components={OVERRIDE_COMPONENTS}
      {...props}
    />
  );
}

export default SentryProjectSelectorField;
