import {useCallback} from 'react';

import {
  type FormFieldProps,
  useFormField,
} from 'sentry/components/deprecatedforms/formField';
import {Tooltip} from 'sentry/components/tooltip';
import {IconQuestion} from 'sentry/icons';
import {defined} from 'sentry/utils';

type Props = FormFieldProps;

const coerceValue = (value: any) => {
  // Handle null/undefined explicitly
  if (value === null || value === undefined || value === '') {
    return false;
  }
  // Convert any truthy/falsy value to boolean
  return Boolean(value);
};

const getClassName = () => 'control-group checkbox';

/**
 * @deprecated Do not use this
 */
function BooleanField(props: Props) {
  const field = useFormField({
    ...props,
    coerceValue,
    getClassName,
  });

  // Handle checkbox change
  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      field.setValue(e.target.checked);
    },
    [field]
  );

  // Determine if error message should be shown
  const shouldShowErrorMessage = field.error && !props.hideErrorMessage;

  return (
    <div className={field.getClassName()}>
      <div className="controls">
        <label className="control-label">
          <input
            id={field.id}
            type="checkbox"
            checked={Boolean(field.value)}
            onChange={handleChange}
            disabled={props.disabled}
          />
          {props.label}
          {props.disabled && props.disabledReason && (
            <Tooltip title={props.disabledReason}>
              <IconQuestion size="xs" />
            </Tooltip>
          )}
        </label>
        {defined(props.help) && <p className="help-block">{props.help}</p>}
        {shouldShowErrorMessage && <p className="error">{field.error}</p>}
      </div>
    </div>
  );
}

export default BooleanField;
