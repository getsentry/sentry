/**
 * A component to render a Field (i.e. label + help + form "control"),
 * generally inside of a Panel.
 *
 * This is unconnected to any Form state
 */

import PropTypes from 'prop-types';
import React from 'react';

import FieldControl from 'app/views/settings/components/forms/field/fieldControl';
import FieldDescription from 'app/views/settings/components/forms/field/fieldDescription';
import FieldHelp from 'app/views/settings/components/forms/field/fieldHelp';
import FieldLabel from 'app/views/settings/components/forms/field/fieldLabel';
import FieldRequiredBadge from 'app/views/settings/components/forms/field/fieldRequiredBadge';
import FieldWrapper from 'app/views/settings/components/forms/field/fieldWrapper';

class Field extends React.Component {
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
     * Padding
     */
    p: PropTypes.number,

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
    help: PropTypes.oneOfType([PropTypes.node, PropTypes.element]),

    /**
     * Should Control be inline with Label
     */
    inline: PropTypes.bool,

    /**
     * The control's `id` property
     */
    id: PropTypes.string,

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
  };

  render() {
    let {className, ...otherProps} = this.props;
    let {
      controlClassName,
      alignRight,
      inline,
      highlighted,
      required,
      visible,
      disabled,
      disabledReason,
      flexibleControlStateSize,
      label,
      help,
      id,
      p,
      children,
      style,
    } = otherProps;
    let isDisabled = typeof disabled === 'function' ? disabled(this.props) : disabled;
    let isVisible = typeof visible === 'function' ? visible(this.props) : visible;
    let Control;

    if (!isVisible) {
      return null;
    }

    let controlProps = {
      className: controlClassName,
      inline,
      alignRight,
      disabled: isDisabled,
      disabledReason,
      flexibleControlStateSize,
    };

    // See comments in prop types
    if (typeof children === 'function') {
      Control = children({
        ...otherProps,
        ...controlProps,
      });
    } else {
      Control = <FieldControl {...controlProps}>{children}</FieldControl>;
    }

    return (
      <FieldWrapper
        p={p}
        className={className}
        inline={inline}
        highlighted={highlighted}
        hasControlState={!flexibleControlStateSize}
        style={style}
      >
        {(label || help) && (
          <FieldDescription inline={inline} htmlFor={id}>
            {label && (
              <FieldLabel>
                {label} {required && <FieldRequiredBadge />}
              </FieldLabel>
            )}
            {help && <FieldHelp>{help}</FieldHelp>}
          </FieldDescription>
        )}

        {Control}
      </FieldWrapper>
    );
  }
}
export default Field;
