import {Checkbox} from '@sentry/scraps/checkbox';
import {Flex} from '@sentry/scraps/layout';

import {FieldDescription} from 'sentry/components/forms/fieldGroup/fieldDescription';
import {FieldHelp} from 'sentry/components/forms/fieldGroup/fieldHelp';
import {FieldLabel} from 'sentry/components/forms/fieldGroup/fieldLabel';
import {FormField} from 'sentry/components/forms/formField';

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
   * Help or description of the field
   */
  help?: React.ReactNode | React.ReactElement | ((props: Props) => React.ReactNode);
  /**
   * User visible field label
   */
  label?: React.ReactNode;
} & FormFieldProps;

export function CheckboxField(props: Props) {
  const {name, stacked, label, help} = props;

  const helpElement = typeof help === 'function' ? help(props) : help;
  const ariaLabel = typeof label === 'string' ? label : undefined;

  return (
    <FormField name={name} inline={false} stacked={stacked}>
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
                checked={value === true}
                onChange={handleChange}
              />
            </Flex>
            <FieldDescription htmlFor={id} aria-label={ariaLabel}>
              {label && (
                <FieldLabel>
                  <span>{label}</span>
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
