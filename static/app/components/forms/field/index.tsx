import QuestionTooltip from 'sentry/components/questionTooltip';

import ControlState from './controlState';
import FieldControl from './fieldControl';
import FieldDescription from './fieldDescription';
import FieldErrorReason from './fieldErrorReason';
import FieldHelp from './fieldHelp';
import FieldLabel from './fieldLabel';
import FieldQuestion from './fieldQuestion';
import FieldRequiredBadge from './fieldRequiredBadge';
import FieldWrapper from './fieldWrapper';
import {FieldGroupProps} from './types';

/**
 * A component to render a Field (i.e. label + help + form "control"),
 * generally inside of a Panel.
 *
 * This is unconnected to any Form state
 */
function Field({
  className,
  disabled = false,
  inline = true,
  visible = true,
  ...rest
}: FieldGroupProps) {
  const props = {
    inline,
    disabled,
    visible,
    ...rest,
  };

  const {
    alignRight,
    children,
    controlClassName,
    disabledReason,
    error,
    flexibleControlStateSize,
    help,
    hideLabel,
    highlighted,
    id,
    isSaved,
    isSaving,
    label,
    labelText,
    required,
    showHelpInTooltip,
    stacked,
    style,
  } = props;

  const isVisible = typeof visible === 'function' ? visible(props) : visible;
  const isDisabled = typeof disabled === 'function' ? disabled(props) : disabled;

  if (!isVisible) {
    return null;
  }

  const helpElement = typeof help === 'function' ? help(props) : help;
  const shouldRenderLabel = !hideLabel && !!label;

  const controlProps = {
    inline,
    alignRight,
    disabledReason,
    flexibleControlStateSize,
    controlState: <ControlState error={!!error} isSaving={isSaving} isSaved={isSaved} />,
    errorState: error ? <FieldErrorReason>{error}</FieldErrorReason> : null,
    className: controlClassName,
    disabled: isDisabled,
    help: helpElement,
  };

  // See comments in prop types
  const control =
    typeof children === 'function' ? (
      children({...props, ...controlProps})
    ) : (
      <FieldControl {...controlProps}>{children}</FieldControl>
    );

  // Provide an `aria-label` to the FieldDescription label if our label is a
  // string value. This helps with testing and accessability. Without this the
  // aria label contains the entire description.
  const ariaLabel = labelText ?? (typeof label === 'string' ? label : undefined);

  // The help ID is used for the input element to have an `aria-describedby`
  const helpId = `${id}_help`;

  return (
    <FieldWrapper
      className={className}
      inline={inline}
      stacked={stacked}
      highlighted={highlighted}
      hasControlState={!flexibleControlStateSize}
      style={style}
    >
      {(shouldRenderLabel || helpElement) && (
        <FieldDescription inline={inline} htmlFor={id} aria-label={ariaLabel}>
          {shouldRenderLabel && (
            <FieldLabel disabled={isDisabled}>
              <span>
                {label}
                {required && <FieldRequiredBadge />}
              </span>
              {helpElement && showHelpInTooltip && (
                <FieldQuestion>
                  <QuestionTooltip position="top" size="sm" title={helpElement} />
                </FieldQuestion>
              )}
            </FieldLabel>
          )}
          {helpElement && !showHelpInTooltip && (
            <FieldHelp id={helpId} stacked={stacked} inline={inline}>
              {helpElement}
            </FieldHelp>
          )}
        </FieldDescription>
      )}
      {control}
    </FieldWrapper>
  );
}

export default Field;
