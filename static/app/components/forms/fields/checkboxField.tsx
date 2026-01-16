import {Checkbox} from 'sentry/components/core/checkbox';
import {Flex} from 'sentry/components/core/layout';
import {FieldDescription} from 'sentry/components/forms/fieldGroup/fieldDescription';
import {FieldHelp} from 'sentry/components/forms/fieldGroup/fieldHelp';
import {FieldLabel} from 'sentry/components/forms/fieldGroup/fieldLabel';
import {FieldRequiredBadge} from 'sentry/components/forms/fieldGroup/fieldRequiredBadge';
import FormField from 'sentry/components/forms/formField';

type FormFieldProps = Omit<
  React.ComponentProps<typeof FormField>,
  'children' | 'help' | 'disabled' | 'required'
>;

type Props = {
  /**
   * The input name
   */
  name: string;
  /**
   * Is the field disabled?
   */
  disabled?: boolean;
  /**
   * Help or description of the field
   */
  help?: React.ReactNode | React.ReactElement | ((props: Props) => React.ReactNode);
  /**
   * User visible field label
   */
  label?: React.ReactNode;
  /**
   * Is the field required?
   */
  required?: boolean;
} & FormFieldProps;

function CheckboxField(props: Props) {
  const {name, disabled, stacked, required, label, help} = props;

  const helpElement = typeof help === 'function' ? help(props) : help;
  const ariaLabel = typeof label === 'string' ? label : undefined;

  return (
    <FormField name={name} inline={false} stacked={stacked} required={required}>
      {({onChange, value, id}: any) => {
        function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
          const newValue = e.target.checked;
          onChange?.(newValue, e);
        }

        return (
          <Flex direction="row">
            <Flex as="span" alignSelf="flex-start" marginRight="md">
              <Checkbox
                id={id}
                name={name}
                disabled={disabled}
                checked={value === true}
                onChange={handleChange}
              />
            </Flex>
            <FieldDescription htmlFor={id} aria-label={ariaLabel}>
              {label && (
                <FieldLabel disabled={disabled}>
                  <span>
                    {label}
                    {required && <FieldRequiredBadge />}
                  </span>
                </FieldLabel>
              )}
              {helpElement && (
                <FieldHelp stacked={stacked} inline>
                  {helpElement}
                </FieldHelp>
              )}
            </FieldDescription>
          </Flex>
        );
      }}
    </FormField>
  );
}

export default CheckboxField;
