/**
 * A component to render a Field (i.e. label + help + form "control"),
 * generally inside of a Panel.
 *
 * This is unconnected to any Form state
 */

import PropTypes from 'prop-types';
import React from 'react';

import FieldControl from './fieldControl';
import FieldDescription from './fieldDescription';
import FieldHelp from './fieldHelp';
import FieldLabel from './fieldLabel';
import FieldRequiredBadge from './fieldRequiredBadge';
import FieldWrapper from './fieldWrapper';

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
    hideControlState: PropTypes.bool,

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
  };

  static defaultProps = {
    alignRight: false,
    inline: true,
    disabled: false,
    required: false,
    visible: true,
  };

  render() {
    let {
      alignRight,
      inline,
      highlighted,
      required,
      visible,
      disabled,
      disabledReason,
      hideControlState,
      label,
      help,
      id,
      children,
    } = this.props;
    let isDisabled = typeof disabled === 'function' ? disabled(this.props) : disabled;
    let isVisible = typeof visible === 'function' ? visible(this.props) : visible;
    let Control;

    if (!isVisible) {
      return null;
    }

    // See comments in prop types
    if (typeof children === 'function') {
      Control = children({
        ...this.props,
        alignRight,
        disabled: isDisabled,
        disabledReason,
      });
    } else {
      Control = (
        <FieldControl
          inline={inline}
          alignRight={alignRight}
          disabled={isDisabled}
          disabledReason={disabledReason}
          hideControlState={hideControlState}
        >
          {children}
        </FieldControl>
      );
    }

    return (
      <FieldWrapper
        inline={inline}
        highlighted={highlighted}
        hasControlState={!hideControlState}
      >
        <FieldDescription inline={inline} htmlFor={id}>
          {label && (
            <FieldLabel>
              {label} {required && <FieldRequiredBadge />}
            </FieldLabel>
          )}
          {help && <FieldHelp>{help}</FieldHelp>}
        </FieldDescription>

        {Control}
      </FieldWrapper>
    );
  }
}
export default Field;
