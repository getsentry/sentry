import QuestionTooltip from 'sentry/components/questionTooltip';

import ControlState from './controlState';
import ControlWrapper from './controlWrapper';
import FieldDescription from './fieldDescription';
import FieldHelp from './fieldHelp';
import FieldLabel from './fieldLabel';
import FieldQuestion from './fieldQuestion';
import FieldRequiredBadge from './fieldRequiredBadge';
import FieldWrapper from './fieldWrapper';
import type {FieldGroupProps} from './types';

/**
 * A component to render a Field (i.e. label + help + form "control"),
 * generally inside of a Panel.
 *
 * This is unconnected to any Form state
 */
function FieldGroup({
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
    error,
    flexibleControlStateSize,
    help,
    hideLabel,
    hideControlState,
    highlighted,
    controlState,
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

  if (!visible) {
    return null;
  }

  const controlStateElement = controlState ?? (
    <ControlState error={error} isSaving={isSaving} isSaved={isSaved} />
  );

  const shouldRenderLabel = !hideLabel && !!label;

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
      <FieldDescription
        displayNone={!shouldRenderLabel && !help}
        inline={inline}
        htmlFor={id}
        aria-label={ariaLabel}
      >
        {shouldRenderLabel && (
          <FieldLabel disabled={disabled}>
            <span>
              {label}
              {required && <FieldRequiredBadge />}
            </span>
            {help && showHelpInTooltip && (
              <FieldQuestion>
                <QuestionTooltip
                  position="top"
                  size="sm"
                  {...(showHelpInTooltip !== true ? showHelpInTooltip : {})}
                  title={help}
                />
              </FieldQuestion>
            )}
          </FieldLabel>
        )}
        {help && !showHelpInTooltip && (
          <FieldHelp id={helpId} stacked={stacked} inline={inline}>
            {help}
          </FieldHelp>
        )}
      </FieldDescription>
      <ControlWrapper
        inline={inline}
        alignRight={alignRight}
        flexibleControlStateSize={flexibleControlStateSize}
        hideControlState={hideControlState}
        controlState={controlStateElement}
      >
        {children}
      </ControlWrapper>
    </FieldWrapper>
  );
}

export default FieldGroup;
