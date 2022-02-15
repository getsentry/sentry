import styled from '@emotion/styled';

import Checkbox from 'sentry/components/checkbox';
import FieldDescription from 'sentry/components/forms/field/fieldDescription';
import FieldHelp from 'sentry/components/forms/field/fieldHelp';
import FieldLabel from 'sentry/components/forms/field/fieldLabel';
import FieldRequiredBadge from 'sentry/components/forms/field/fieldRequiredBadge';
import FormField from 'sentry/components/forms/formField';
import space from 'sentry/styles/space';

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
   * The control's `id` property
   */
  id?: string;
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
  const {name, disabled, stacked, id, required, label, help} = props;

  const helpElement = typeof help === 'function' ? help(props) : help;

  return (
    <FormField name={name} inline={false} stacked={stacked}>
      {({onChange, value}) => {
        function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
          const newValue = e.target.checked;
          onChange?.(newValue, e);
        }

        return (
          <FieldLayout>
            <ControlWrapper>
              <Checkbox
                id={id}
                name={name}
                disabled={disabled}
                checked={value === true}
                onChange={handleChange}
              />
            </ControlWrapper>
            <FieldDescription htmlFor={id}>
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
          </FieldLayout>
        );
      }}
    </FormField>
  );
}

const ControlWrapper = styled('span')`
  align-self: flex-start;
  display: flex;
  margin-right: ${space(1)};

  & input {
    margin: 0;
  }
`;

const FieldLayout = styled('div')`
  display: flex;
  flex-direction: row;
`;

export default CheckboxField;
