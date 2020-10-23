import React from 'react';
import {components} from 'react-select';

import {t} from 'app/locale';
import InputField from 'app/views/settings/components/forms/inputField';
import IdBadge from 'app/components/idBadge';
import SelectControl from 'app/components/forms/selectControl';
import {Project} from 'app/types';

const defaultProps = {
  avatarSize: 20,
  placeholder: t('Choose Sentry project\u2026'),
};

type Props = InputField['props'];

type RenderProps = {
  projects: Project[]; //can't use AvatarProject since we need the ID
} & Omit<Partial<Readonly<typeof defaultProps>>, 'placeholder'> &
  Props;

class RenderField extends React.Component<RenderProps> {
  static defaultProps = defaultProps;
  render() {
    const {projects, avatarSize, ...rest} = this.props;

    const projectOptions = projects.map(({slug, id}) => [id, slug]);

    const customOptionProject = projectProps => {
      const project = projects.find(proj => proj.id === projectProps.value);
      //shouldn't happen but need to account for it
      if (!project) {
        return <components.Option {...projectProps} />;
      }
      return (
        <components.Option {...projectProps}>
          <IdBadge
            project={project}
            avatarSize={avatarSize}
            displayName={project.slug}
            avatarProps={{consistentWidth: true}}
          />
        </components.Option>
      );
    };

    const customValueContainer = containerProps => {
      const selectedValue = containerProps.getValue()[0];
      const project = projects.find(proj => proj.id === selectedValue?.value);
      //shouldn't happen but need to account for it
      if (!project) {
        return <components.ValueContainer {...containerProps} />;
      }
      return (
        <components.ValueContainer {...containerProps}>
          <IdBadge
            project={project}
            avatarSize={avatarSize}
            displayName={project.slug}
            avatarProps={{consistentWidth: true}}
          />
        </components.ValueContainer>
      );
    };

    return (
      <SelectControl
        choices={projectOptions}
        components={{
          Option: customOptionProject,
          ValueContainer: customValueContainer,
        }}
        {...rest}
      />
    );
  }
}

const SentryProjectSelectorField = (props: Props) => (
  <InputField
    {...props}
    field={(renderProps: RenderProps) => <RenderField {...renderProps} />}
  />
);

export default SentryProjectSelectorField;
