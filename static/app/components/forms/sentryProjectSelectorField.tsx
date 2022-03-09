import * as React from 'react';
import {components} from 'react-select';

import InputField, {InputFieldProps} from 'sentry/components/forms/inputField';
import SelectControl from 'sentry/components/forms/selectControl';
import IdBadge from 'sentry/components/idBadge';
import {t} from 'sentry/locale';
import {Project} from 'sentry/types';

const defaultProps = {
  avatarSize: 20,
  placeholder: t('Choose Sentry project'),
};

// projects can be passed as a direct prop as well
export interface RenderFieldProps extends InputFieldProps {
  projects?: Project[];
}

interface RenderProps
  extends Omit<Partial<Readonly<typeof defaultProps>>, 'placeholder'>,
    RenderFieldProps {
  projects: Project[]; // can't use AvatarProject since we need the ID
}

class RenderField extends React.Component<RenderProps> {
  static defaultProps = defaultProps;

  // need to map the option object to the value
  handleChange = (
    onBlur: RenderFieldProps['onBlur'],
    onChange: RenderFieldProps['onChange'],
    optionObj: {value: any},
    event: React.MouseEvent
  ) => {
    const {value} = optionObj;
    onChange?.(value, event);
    onBlur?.(value, event);
  };

  render() {
    const {projects, avatarSize, onChange, onBlur, ...rest} = this.props;

    const projectOptions = projects.map(({slug, id}) => ({value: id, label: slug}));

    const customOptionProject = projectProps => {
      const project = projects.find(proj => proj.id === projectProps.value);
      // shouldn't happen but need to account for it
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
      // shouldn't happen but need to account for it
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
        options={projectOptions}
        components={{
          Option: customOptionProject,
          SingleValue: customValueContainer,
        }}
        {...rest}
        onChange={this.handleChange.bind(this, onBlur, onChange)}
      />
    );
  }
}

const SentryProjectSelectorField = (props: RenderFieldProps) => (
  <InputField
    {...props}
    field={(renderProps: RenderProps) => <RenderField {...renderProps} />}
  />
);

export default SentryProjectSelectorField;
