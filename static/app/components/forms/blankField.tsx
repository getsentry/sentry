import * as React from 'react';

import Field, {FieldProps} from 'sentry/components/forms/field';

/**
 * This class is meant to hook into `fieldFromConfig`. Like the FieldSeparator
 * class, this doesn't have any fields of its own and is just meant to make
 * forms more flexible.
 */
export default class BlankField extends React.Component<FieldProps> {
  render() {
    return <Field {...this.props} />;
  }
}

export default BlankField;
