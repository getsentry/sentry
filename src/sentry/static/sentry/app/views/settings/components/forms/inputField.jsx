import PropTypes from 'prop-types';
import React from 'react';

import FormField from 'app/views/settings/components/forms/formField';
import Input from 'app/views/settings/components/forms/controls/input';

export default class InputField extends React.Component {
  static propTypes = {
    ...FormField.propTypes,
    field: PropTypes.func,
  };

  static defaultProps = {
    field: ({onChange, onBlur, onKeyDown, ...props}) => (
      <Input
        {...props}
        onBlur={e => onBlur(e.target.value, e)}
        onKeyDown={e => onKeyDown(e.target.value, e)}
        onChange={e => onChange(e.target.value, e)}
      />
    ),
  };

  render() {
    let {className, field} = this.props;

    return (
      <FormField className={className} {...this.props}>
        {({children, ...formFieldProps}) => {
          return field({
            ...formFieldProps,
          });
        }}
      </FormField>
    );
  }
}
