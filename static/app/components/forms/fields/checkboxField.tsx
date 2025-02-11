import styled from '@emotion/styled';

import Checkbox from 'sentry/components/checkbox';
import {space} from 'sentry/styles/space';

import {FieldDescription} from '../fieldGroup/fieldDescription';
import {FieldHelp} from '../fieldGroup/fieldHelp';
import {FieldLabel} from '../fieldGroup/fieldLabel';
import {FieldRequiredBadge} from '../fieldGroup/fieldRequiredBadge';
import FormField from '../formField';

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
`;

const FieldLayout = styled('div')`
  display: flex;
  flex-direction: row;
`;

export default CheckboxField;
