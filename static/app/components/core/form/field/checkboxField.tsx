import {Checkbox, type CheckboxProps} from '@sentry/scraps/checkbox';
import {FieldMeta} from '@sentry/scraps/form/field/meta';
import {Container, Flex, Grid} from '@sentry/scraps/layout';

import {BaseField, type BaseFieldProps} from './baseField';

type Props = BaseFieldProps<HTMLInputElement> &
  Omit<CheckboxProps, 'checked' | 'onChange' | 'onBlur' | 'disabled' | 'id' | 'ref'> & {
    checked: boolean;
    label: React.ReactNode;
    onChange: (checked: boolean) => void;
    hintText?: React.ReactNode;
  };

export function CheckboxField({
  checked,
  disabled,
  hintText,
  label,
  onChange,
  ref,
  ...props
}: Props) {
  return (
    <BaseField disabled={disabled} ref={ref}>
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
    </BaseField>
  );
}
