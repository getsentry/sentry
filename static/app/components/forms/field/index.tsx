/**
 * A component to render a Field (i.e. label + help + form "control"),
 * generally inside of a Panel.
 *
 * This is unconnected to any Form state
 */

import * as React from 'react';

import ControlState from 'sentry/components/forms/field/controlState';
import FieldControl from 'sentry/components/forms/field/fieldControl';
import FieldDescription from 'sentry/components/forms/field/fieldDescription';
import FieldErrorReason from 'sentry/components/forms/field/fieldErrorReason';
import FieldHelp from 'sentry/components/forms/field/fieldHelp';
import FieldLabel from 'sentry/components/forms/field/fieldLabel';
import FieldRequiredBadge from 'sentry/components/forms/field/fieldRequiredBadge';
import FieldWrapper from 'sentry/components/forms/field/fieldWrapper';
import QuestionTooltip from 'sentry/components/questionTooltip';

import FieldQuestion from './fieldQuestion';

type InheritedFieldWrapperProps = Pick<
  React.ComponentProps<typeof FieldWrapper>,
  'inline' | 'stacked' | 'highlighted' | 'hasControlState'
>;

type InheritedFieldControlProps = Omit<
  React.ComponentProps<typeof FieldControl>,
  'children' | 'disabled' | 'className' | 'help' | 'errorState'
>;

type InheritedControlStateProps = Omit<
  React.ComponentProps<typeof ControlState>,
  'children' | 'error'
>;

type Props = InheritedFieldControlProps &
  InheritedFieldWrapperProps &
  InheritedControlStateProps & {
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
    disabled?: boolean | ((props: Props) => boolean);
    /**
     * Error message to display for the field
     */
    error?: string;
    /**
     * Help or description of the field
     */
    help?: React.ReactNode | React.ReactElement | ((props: Props) => React.ReactNode);
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
    visible?: boolean | ((props: Props) => boolean);
  };

type ChildRenderProps = Omit<Props, 'className' | 'disabled'> & {
  controlState: React.ReactNode;
  errorState: React.ReactNode | null;
  help: React.ReactNode;
  disabled?: boolean;
};

class Field extends React.Component<Props> {
  static defaultProps = {
    alignRight: false,
    inline: true,
    disabled: false,
    required: false,
    visible: true,
    showHelpInTooltip: false,
  };

  render() {
    const {className, ...otherProps} = this.props;
    const {
      controlClassName,
      alignRight,
      inline,
      highlighted,
      required,
      visible,
      disabled,
      disabledReason,
      error,
      flexibleControlStateSize,
      help,
      id,
      isSaving,
      isSaved,
      label,
      hideLabel,
      stacked,
      children,
      style,
      showHelpInTooltip,
    } = otherProps;
    const isDisabled = typeof disabled === 'function' ? disabled(this.props) : disabled;
    const isVisible = typeof visible === 'function' ? visible(this.props) : visible;
    let Control: React.ReactNode;

    if (!isVisible) {
      return null;
    }

    const helpElement = typeof help === 'function' ? help(this.props) : help;

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
          <FieldDescription inline={inline} htmlFor={id}>
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
}

export default Field;
