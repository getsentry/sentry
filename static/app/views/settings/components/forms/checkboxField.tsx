import styled from '@emotion/styled';

import Checkbox from 'app/components/checkbox';
import space from 'app/styles/space';
import FieldDescription from 'app/views/settings/components/forms/field/fieldDescription';
import FieldHelp from 'app/views/settings/components/forms/field/fieldHelp';
import FieldLabel from 'app/views/settings/components/forms/field/fieldLabel';
import FieldRequiredBadge from 'app/views/settings/components/forms/field/fieldRequiredBadge';
import FormField from 'app/views/settings/components/forms/formField';

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
   * User visible field label
   */
  label?: React.ReactNode;
  /**
   * Is the field disabled?
   */
  disabled?: boolean;
  /**
   * Is the field required?
   */
  required?: boolean;
  /**
   * Help or description of the field
   */
  help?: React.ReactNode | React.ReactElement | ((props: Props) => React.ReactNode);
  /**
   * The control's `id` property
   */
  id?: string;
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
