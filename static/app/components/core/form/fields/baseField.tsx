import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {useFieldContext} from '@sentry/scraps/form/formContext';
import {Checkmark, Spinner, Warning} from '@sentry/scraps/form/icons';
import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

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

type FieldStateProps = {
  indicator: React.JSX.Element | null;
};

const useFieldStateIndicator = () => {
  const field = useFieldContext();
  const hasValidationError = field.state.meta.isTouched && !field.state.meta.isValid;
  const status = useAutoSaveContext()?.status;

  if (status === 'pending') {
    return <Spinner />;
  }

  if (status === 'success') {
    return <Checkmark variant="success" size="sm" />;
  }

  if (hasValidationError) {
    const errorMessage = field.state.meta.errors.map(e => e?.message).join(',');
    return (
      <Tooltip position="bottom" offset={8} title={errorMessage} forceVisible skipWrapper>
        <Warning variant="danger" size="sm" />
      </Tooltip>
    );
  }
  return null;
};

export function BaseField(
  props: BaseFieldProps & {
    children: (props: FieldChildrenProps, state: FieldStateProps) => React.ReactNode;
  }
) {
  const field = useFieldContext();
  const hasError = field.state.meta.isTouched && !field.state.meta.isValid;
  const indicator = useFieldStateIndicator();

  return (
    <Stack as="label" gap="sm">
      <Text>
        {props.label} {props.required ? <Text variant="danger">*</Text> : null}
      </Text>
      {props.children(
        {
          'aria-invalid': hasError,
          onBlur: field.handleBlur,
          name: field.name,
        },
        {indicator}
      )}
      {props.hintText ? (
        <Text size="sm" variant="muted">
          {props.hintText}
        </Text>
      ) : null}
    </Stack>
  );
}
