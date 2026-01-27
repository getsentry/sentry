import {useFieldContext} from '@sentry/scraps/form/formContext';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

export type BaseFieldProps = {
  label: string;
  hintText?: string;
  required?: boolean;
};

type FieldChildrenProps = {
  'aria-invalid': boolean;
  name: string;
  onBlur: () => void;
};

export function BaseField(
  props: BaseFieldProps & {children: (props: FieldChildrenProps) => React.ReactNode}
) {
  const field = useFieldContext();
  const hasError = field.state.meta.isTouched && !field.state.meta.isValid;
  return (
    <Stack as="label" gap="sm">
      <Text>
        {props.label} {props.required ? <Text variant="danger">*</Text> : null}
      </Text>
      {props.children({
        'aria-invalid': hasError,
        onBlur: field.handleBlur,
        name: field.name,
      })}
      {props.hintText ? (
        <Text size="sm" variant="muted">
          {props.hintText}
        </Text>
      ) : null}
      {hasError ? (
        <Text size="sm" variant="danger">
          {field.state.meta.errors.map(e => e?.message).join(',')}
        </Text>
      ) : null}
    </Stack>
  );
}
