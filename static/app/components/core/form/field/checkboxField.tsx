import {Checkbox, type CheckboxProps} from '@sentry/scraps/checkbox';
import {FieldMeta} from '@sentry/scraps/form/field/meta';
import type {AnyFieldApi} from '@sentry/scraps/form/formHelpers';
import {Container, Flex, Grid} from '@sentry/scraps/layout';

import {BaseFieldImpl, type BaseFieldProps} from './baseField';

type Props = BaseFieldProps<HTMLInputElement> & {field: AnyFieldApi} & Omit<
    CheckboxProps,
    'checked' | 'onChange' | 'onBlur' | 'disabled' | 'id' | 'ref'
  > & {
    checked: boolean;
    label: React.ReactNode;
    onChange: (checked: boolean) => void;
    hintText?: React.ReactNode;
  };

export function CheckboxField({
  checked,
  field,
  disabled,
  hintText,
  label,
  onChange,
  ref,
  ...props
}: Props) {
  return (
    <BaseFieldImpl field={field} disabled={disabled} ref={ref}>
      {(fieldProps, {indicator}) => (
        <Grid
          columns="max-content minmax(0, 1fr)"
          gap="xs sm"
          align="center"
          flexGrow={1}
        >
          <Checkbox
            {...fieldProps}
            {...props}
            checked={checked}
            onChange={event => onChange(event.target.checked)}
          />
          <Flex align="center" gap="sm">
            <FieldMeta.Label>{label}</FieldMeta.Label>
            {indicator}
          </Flex>
          {hintText && (
            <Container column={2}>
              <FieldMeta.HintText>{hintText}</FieldMeta.HintText>
            </Container>
          )}
        </Grid>
      )}
    </BaseFieldImpl>
  );
}
