import {Component} from 'react';

import SelectControl from 'sentry/components/forms/controls/selectControl';
import FormField from 'sentry/components/forms/formField';
import IdBadge from 'sentry/components/idBadge';
import {t} from 'sentry/locale';
import {Project} from 'sentry/types';

// XXX(epurkhiser): This is wrong, it should not be inheriting these props
import {InputFieldProps} from './inputField';

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
    const {
      children: _children,
      projects,
      avatarSize,
      onChange,
      onBlur,
      ...rest
    } = this.props;

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
  <FormField {...props}>{fieldProps => <RenderField {...fieldProps} />}</FormField>
);

export default SentryProjectSelectorField;
