import * as React from 'react';

import Field from 'sentry/components/forms/field';

type Props = Field['props'];

/**
 * This class is meant to hook into `fieldFromConfig`. Like the FieldSeparator
 * class, this doesn't have any fields of its own and is just meant to make
 * forms more flexible.
 */
export default class BlankField extends React.Component<Props> {
  render() {
    return <Field {...this.props} />;
  }
}
