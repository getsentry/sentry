import Field, {FieldProps} from 'sentry/components/forms/field';

/**
 * This class is meant to hook into `fieldFromConfig`. Like the SeparatorField
 * class, this doesn't have any fields of its own and is just meant to make
 * forms more flexible.
 */
function BlankField(props: FieldProps) {
  return <Field {...props} />;
}

export default BlankField;
