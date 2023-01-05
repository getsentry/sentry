import FieldGroup from 'sentry/components/forms/field';
import {FieldGroupProps} from 'sentry/components/forms/field/types';

/**
 * This class is meant to hook into `fieldFromConfig`. Like the SeparatorField
 * class, this doesn't have any fields of its own and is just meant to make
 * forms more flexible.
 */
function BlankField(props: FieldGroupProps) {
  return <FieldGroup {...props} />;
}

export default BlankField;
