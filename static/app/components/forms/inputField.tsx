import * as React from 'react';
import omit from 'lodash/omit';

import Input from 'sentry/components/forms/controls/input';
import FormField from 'sentry/components/forms/formField';

type Props = {
  // TODO(ts) Add base types for this. Each input field
  // has different props, but we could use have a base type that contains
  // the common properties.
  field?: (props) => React.ReactNode;
  value?: any;
} & Omit<FormField['props'], 'children'> &
  Omit<
    React.ComponentPropsWithoutRef<'input'>,
    'value' | 'placeholder' | 'disabled' | 'onBlur' | 'onKeyDown' | 'onChange'
  >;

export type onEvent = (value, event?: React.FormEvent<HTMLInputElement>) => void;

export default class InputField extends React.Component<Props> {
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
    const {className, field} = this.props;

    return (
      <FormField className={className} {...this.props}>
        {formFieldProps => field && field(omit(formFieldProps, 'children'))}
      </FormField>
    );
  }
}
