import * as React from 'react';
import omit from 'lodash/omit';

import Input from 'sentry/components/forms/controls/input';
import FormField, {FormFieldProps} from 'sentry/components/forms/formField';

export interface InputFieldProps<P>
  extends Omit<FormFieldProps<P>, 'children'>,
    Omit<
      React.ComponentPropsWithoutRef<'input'>,
      | 'value'
      | 'placeholder'
      | 'disabled'
      | 'onBlur'
      | 'onKeyDown'
      | 'onChange'
      | 'children'
      | 'name'
      | 'defaultValue'
    > {
  // TODO(ts) Add base types for this. Each input field
  // has different props, but we could use have a base type that contains
  // the common properties.
  field?: (props) => React.ReactNode;
  value?: any;
}

export type onEvent = (value, event?: React.FormEvent<HTMLInputElement>) => void;

export default class InputField<P extends {} = {}> extends React.Component<
  InputFieldProps<P>
> {
  static defaultProps = {
    field: ({
      onChange,
      onBlur,
      onKeyDown,
      ...props
    }: {
      onBlur: onEvent;
      onChange: onEvent;
      onKeyDown: onEvent;
    }) => (
      <Input
        {...props}
        onBlur={e => onBlur(e.target.value, e)}
        onKeyDown={e => onKeyDown((e.target as any).value, e)}
        onChange={e => onChange(e.target.value, e)}
      />
    ),
  };

  render() {
    return (
      <FormField className={this.props.className} {...this.props}>
        {formFieldProps =>
          this.props.field && this.props.field(omit(formFieldProps, 'children'))
        }
      </FormField>
    );
  }
}
