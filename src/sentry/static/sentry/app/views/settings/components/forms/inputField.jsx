import PropTypes from 'prop-types';
import React from 'react';
import omit from 'lodash/omit';

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
    const {className, field} = this.props;

    return (
      <FormField className={className} {...this.props}>
        {formFieldProps => field(omit(formFieldProps, 'children'))}
      </FormField>
    );
  }
}
