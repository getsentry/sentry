/**
 * A component to render a Field (i.e. label + help + form "control"),
 * generally inside of a Panel.
 *
 * This is unconnected to any Form state
 */

import PropTypes from 'prop-types';
import * as React from 'react';

import QuestionTooltip from 'app/components/questionTooltip';
import ControlState from 'app/views/settings/components/forms/field/controlState';
import FieldControl from 'app/views/settings/components/forms/field/fieldControl';
import FieldDescription from 'app/views/settings/components/forms/field/fieldDescription';
import FieldErrorReason from 'app/views/settings/components/forms/field/fieldErrorReason';
import FieldHelp from 'app/views/settings/components/forms/field/fieldHelp';
import FieldLabel from 'app/views/settings/components/forms/field/fieldLabel';
import FieldRequiredBadge from 'app/views/settings/components/forms/field/fieldRequiredBadge';
import FieldWrapper, {
  Props as FieldWrapperProps,
} from 'app/views/settings/components/forms/field/fieldWrapper';

import FieldQuestion from './fieldQuestion';

type ChildrenFunction = (props) => React.ReactNode;

type Props = {
  alignRight?: boolean;
  required?: boolean;
  visible?: boolean | ((props) => boolean);
  disabled?: boolean | ((props) => boolean);
  disabledReason?: string;
  flexibleControlStateSize?: boolean;
  label?: React.ReactNode;
  help?: React.ReactNode | React.ReactElement | Function;
  showHelpInTooltip?: boolean;
  id?: string;
  children?: React.ReactNode | ChildrenFunction;
  controlClassName?: string;
  style?: object;
  error?: string;
  validate?: Function; //TODO(TS): Do we need this?
  className?: string; //Needed for styled components
} & Omit<
  FieldControl['props'],
  'disabled' | 'inline' | 'className' | 'help' | 'errorState'
> &
  FieldWrapperProps &
  Omit<ControlState['props'], 'error'>;

class Field extends React.Component<Props> {
  static propTypes = {
    /**
     * Aligns Control to the right
     */
    alignRight: PropTypes.bool,

    /**
     * Is "highlighted", i.e. after a search
     */
    highlighted: PropTypes.bool,

    /**
     * Show "required" indicator
     */
    required: PropTypes.bool,

    /**
     * Should field be visible
     */
    visible: PropTypes.oneOfType([PropTypes.bool, PropTypes.func]),

    /**
     * Should field be disabled?
     */
    disabled: PropTypes.oneOfType([PropTypes.bool, PropTypes.func]),

    /**
     * Reason why field is disabled (displays in tooltip)
     */
    disabledReason: PropTypes.string,

    /**
     * Displays the help element in the tooltip
     */
    showHelpInTooltip: PropTypes.bool,

    /**
     * Error message
     */
    error: PropTypes.string,

    /**
     * Hide ControlState component
     */
    flexibleControlStateSize: PropTypes.bool,

    /**
     * User-facing field name
     */
    label: PropTypes.node,

    /**
     * Help or description of the field
     */
    help: PropTypes.oneOfType([PropTypes.node, PropTypes.element, PropTypes.func]),

    /**
     * Should Control be inline with Label
     */
    inline: PropTypes.bool,

    /**
     * Should the field display in a stacked manner (no borders + reduced padding
     */
    stacked: PropTypes.bool,

    /**
     * The control's `id` property
     */
    id: PropTypes.string,

    /**
     * Field is in saving state
     */
    isSaving: PropTypes.bool,

    /**
     * Field has finished saving state
     */
    isSaved: PropTypes.bool,

    /**
     * The Control component
     */
    children: PropTypes.oneOfType([PropTypes.node, PropTypes.func]),

    /**
     * Class name for inner control
     */
    controlClassName: PropTypes.string,

    /** Inline style */
    style: PropTypes.object,
  };

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
    if (typeof children === 'function') {
      //need to cast b/c TS claims children is not otherwise callable
      Control = (children as ChildrenFunction)({
        ...otherProps,
        ...controlProps,
      });
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
        {(label || helpElement) && (
          <FieldDescription inline={inline} htmlFor={id}>
            {label && (
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
