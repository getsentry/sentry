import IdBadge from 'sentry/components/idBadge';
import {t} from 'sentry/locale';
import {Project} from 'sentry/types';

// XXX(epurkhiser): This is wrong, it should not be inheriting these props
import {InputFieldProps} from './inputField';
import SelectField from './selectField';

// projects can be passed as a direct prop as well
export interface RenderFieldProps extends InputFieldProps {
  avatarSize?: number;
  projects?: Project[];
  /**
   * Use the slug as the select field value. Without setting this the numeric id
   * of the project will be used.
   */
  valueIsSlug?: boolean;
}

function SentryProjectSelectorField({
  projects,
  avatarSize = 20,
  placeholder = t('Choose Sentry project'),
  valueIsSlug,
  ...props
}: RenderFieldProps) {
  const projectOptions = projects?.map(project => ({
    value: project[valueIsSlug ? 'slug' : 'id'],
    label: project.slug,
    leadingItems: (
      <IdBadge
        project={project}
        avatarSize={avatarSize}
        avatarProps={{consistentWidth: true}}
        hideName
      />
    ),
  }));

  return <SelectField placeholder={placeholder} options={projectOptions} {...props} />;
}

export default SentryProjectSelectorField;
