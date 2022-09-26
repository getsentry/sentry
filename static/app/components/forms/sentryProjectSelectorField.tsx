import {Component} from 'react';

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

class RenderField extends Component<RenderProps> {
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

    const projectOptions = projects.map(project => ({
      value: project.id,
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

    return (
      <SelectControl
        options={projectOptions}
        onChange={this.handleChange.bind(this, onBlur, onChange)}
        {...rest}
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
