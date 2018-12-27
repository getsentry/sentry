import PropTypes from 'prop-types';
import React from 'react';
import classNames from 'classnames';

import FormField from 'app/components/forms/formField';
import Tooltip from 'app/components/tooltip';

import {defined} from 'app/utils';

export default class MultipleCheckboxField extends FormField {
  static propTypes = {
    ...FormField.propTypes,
    hideLabelDivider: PropTypes.bool,
    choices: PropTypes.array.isRequired,
  };

  onChange = (value, e) => {
    let allValues = this.state.value;
    if (e.target.checked) {
      if (allValues) {
        allValues = [...allValues, value];
      } else {
        allValues = [value];
      }
    } else {
      allValues = allValues.filter(v => v !== value);
    }
    this.setValue(allValues);
  };

  render() {
    let {
      required,
      className,
      disabled,
      disabledReason,
      label,
      help,
      choices,
      hideLabelDivider,
      style,
    } = this.props;
    let {error} = this.state;
    let cx = classNames(className, 'control-group', {
      'has-error': error,
    });
    // Hacky, but this isn't really a form label vs the checkbox labels, but
    // we want to treat it as one (i.e. for "required" indicator)
    let labelCx = classNames({
      required,
    });
    let shouldShowDisabledReason = disabled && disabledReason;

    return (
      <div style={style} className={cx}>
        <div className={labelCx}>
          <div className="controls">
            <label
              className="control-label"
              style={{
                display: 'block',
                marginBottom: !hideLabelDivider ? 10 : undefined,
                borderBottom: !hideLabelDivider ? '1px solid #f1eff3' : undefined,
              }}
            >
              {label}
              {shouldShowDisabledReason && (
                <Tooltip title={disabledReason}>
                  <span className="disabled-indicator">
                    <span className="icon-question" />
                  </span>
                </Tooltip>
              )}
            </label>
            {help && <p className="help-block">{help}</p>}
            {error && <p className="error">{error}</p>}
          </div>
        </div>

        <div className="control-list">
          {choices.map(([value, choiceLabel]) => {
            return (
              <label className="checkbox" key={value}>
                <input
                  type="checkbox"
                  value={value}
                  onChange={this.onChange.bind(this, value)}
                  disabled={disabled}
                  checked={
                    defined(this.state.value) && this.state.value.indexOf(value) !== -1
                  }
                />
                {choiceLabel}
              </label>
            );
          })}
        </div>
      </div>
    );
  }
}
