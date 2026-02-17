import {useAutoSaveContext} from '@sentry/scraps/form/autoSaveContext';
import {useFieldContext} from '@sentry/scraps/form/formContext';
import {Checkmark, Spinner, Warning} from '@sentry/scraps/form/icons';
import {Tooltip} from '@sentry/scraps/tooltip';

export type BaseFieldProps = Record<never, unknown>;

type FieldChildrenProps = {
  'aria-describedby': string;
  'aria-invalid': boolean;
  id: string;
  name: string;
  onBlur: () => void;
};

export const useFieldStateIndicator = () => {
  const field = useFieldContext();
  const hasValidationError = field.state.meta.isTouched && !field.state.meta.isValid;
  const status = useAutoSaveContext()?.status;

  if (status === 'pending') {
    return (
      <Spinner role="status" aria-label={`Saving ${field.name}`} aria-live="polite" />
    );
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

export const useFieldId = () => {
  const field = useFieldContext();

  return field.form.formId + field.name;
};

export const useHintTextId = () => {
  const fieldId = useFieldId();

  return `${fieldId}-hint`;
};

export function BaseField(
  props: BaseFieldProps & {
    children: (props: FieldChildrenProps) => React.ReactNode;
  }
) {
  const field = useFieldContext();
  const hasError = field.state.meta.isTouched && !field.state.meta.isValid;
  const fieldId = useFieldId();
  const hintTextId = useHintTextId();

  return props.children({
    'aria-invalid': hasError,
    'aria-describedby': hintTextId,
    onBlur: field.handleBlur,
    name: field.name,
    id: fieldId,
  });
}
