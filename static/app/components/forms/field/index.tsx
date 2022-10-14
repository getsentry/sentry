import QuestionTooltip from 'sentry/components/questionTooltip';

import ControlState, {ControlStateProps} from './controlState';
import FieldControl, {FieldControlProps} from './fieldControl';
import FieldDescription from './fieldDescription';
import FieldErrorReason from './fieldErrorReason';
import FieldHelp from './fieldHelp';
import FieldLabel from './fieldLabel';
import FieldQuestion from './fieldQuestion';
import FieldRequiredBadge from './fieldRequiredBadge';
import FieldWrapper, {FieldWrapperProps} from './fieldWrapper';

interface InheritedFieldWrapperProps
  extends Pick<
    FieldWrapperProps,
    'inline' | 'stacked' | 'highlighted' | 'hasControlState'
  > {}

interface InheritedFieldControlProps
  extends Omit<
    FieldControlProps,
    'children' | 'disabled' | 'className' | 'help' | 'errorState'
  > {}

interface InheritedControlStateProps
  extends Omit<ControlStateProps, 'children' | 'error'> {}

export interface FieldProps
  extends InheritedFieldControlProps,
    InheritedFieldWrapperProps,
    InheritedControlStateProps {
  // TODO(TS): Do we need this?
  /**
   * The control to render. May be given a function to render with resolved
   * props.
   */
  children?: React.ReactNode | ((props: ChildRenderProps) => React.ReactNode);
  /**
   * The classname of the field
   */
  className?: string;
  /**
   * The classname of the field control
   */
  controlClassName?: string;
  /**
   * Should field be disabled?
   */
  disabled?: boolean | ((props: FieldProps) => boolean);
  /**
   * Error message to display for the field
   */
  error?: string;
  /**
   * Help or description of the field
   */
  help?: React.ReactNode | React.ReactElement | ((props: FieldProps) => React.ReactNode);
  /**
   * Should the label be rendered for the field?
   */
  hideLabel?: boolean;
  /**
   * The control's `id` property
   */
  id?: string;
  /**
   * User-facing field name
   */
  label?: React.ReactNode;
  /**
   * May be used to give the field an aria-label when the field's label is a
   * react node.
   */
  labelText?: string;
  /**
   * Show "required" indicator
   */
  required?: boolean;
  /**
   * Displays the help element in the tooltip
   */
  showHelpInTooltip?: boolean;
  /**
   * Additional inline styles for the field
   */
  style?: React.CSSProperties;
  validate?: Function;
  /**
   * Should field be visible
   */
  visible?: boolean | ((props: FieldProps) => boolean);
}

interface ChildRenderProps extends Omit<FieldProps, 'className' | 'disabled'> {
  controlState: React.ReactNode;
  errorState: React.ReactNode | null;
  help: React.ReactNode;
  disabled?: boolean;
}

/**
 * A component to render a Field (i.e. label + help + form "control"),
 * generally inside of a Panel.
 *
 * This is unconnected to any Form state
 */
function Field({
  className,
  alignRight = false,
  inline = true,
  disabled = false,
  required = false,
  visible = true,
  showHelpInTooltip = false,
  ...props
}: FieldProps) {
  const otherProps = {
    alignRight,
    inline,
    disabled,
    required,
    visible,
    showHelpInTooltip,
    ...props,
  };

  const {
    controlClassName,
    highlighted,
    disabledReason,
    error,
    flexibleControlStateSize,
    help,
    id,
    isSaving,
    isSaved,
    label,
    labelText,
    hideLabel,
    stacked,
    children,
    style,
  } = otherProps;

  const isVisible = typeof visible === 'function' ? visible(otherProps) : visible;
  const isDisabled = typeof disabled === 'function' ? disabled(otherProps) : disabled;
  let Control: React.ReactNode;

  if (!isVisible) {
    return null;
  }

  const helpElement = typeof help === 'function' ? help(otherProps) : help;

  const controlProps = {
    className: controlClassName,
    inline,
    alignRight,
    disabled: isDisabled,
    disabledReason,
    flexibleControlStateSize,
    help: helpElement,
    errorState: error ? <FieldErrorReason>{error}</FieldErrorReason> : null,
    controlState: <ControlState error={error} isSaving={isSaving} isSaved={isSaved} />,
  };

  // See comments in prop types
  if (children instanceof Function) {
    Control = children({...otherProps, ...controlProps});
  } else {
    Control = <FieldControl {...controlProps}>{children}</FieldControl>;
  }

  // Provide an `aria-label` to the FieldDescription label if our label is a
  // string value. This helps with testing and accessability. Without this the
  // aria label contains the entire description.
  const ariaLabel = labelText ?? (typeof label === 'string' ? label : undefined);

  return (
    <FieldWrapper
      className={className}
      inline={inline}
      stacked={stacked}
      highlighted={highlighted}
      hasControlState={!flexibleControlStateSize}
      style={style}
    >
      {((label && !hideLabel) || helpElement) && (
        <FieldDescription inline={inline} htmlFor={id} aria-label={ariaLabel}>
          {label && !hideLabel && (
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
            <FieldHelp stacked={stacked} inline={inline}>
              {helpElement}
            </FieldHelp>
          )}
        </FieldDescription>
      )}

      {Control}
    </FieldWrapper>
  );
}

export default Field;
