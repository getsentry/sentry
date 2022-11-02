import Field from 'sentry/components/forms/field';
import {FieldGroupProps} from 'sentry/components/forms/field/types';

/**
 * This class is meant to hook into `fieldFromConfig`. Like the SeparatorField
 * class, this doesn't have any fields of its own and is just meant to make
 * forms more flexible.
 */
function BlankField(props: FieldGroupProps) {
  return <Field {...props} />;
}

export default BlankField;
