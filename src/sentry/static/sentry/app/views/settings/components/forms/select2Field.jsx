import PropTypes from 'prop-types';
import React from 'react';
import jQuery from 'jquery';

import InputField from './inputField';

export default class Select2Field extends React.Component {
  static propTypes = {
    ...InputField.propTypes,
    choices: PropTypes.array.isRequired,
    allowClear: PropTypes.bool,
    allowEmpty: PropTypes.bool,
    multiple: PropTypes.bool,
    escapeMarkup: PropTypes.bool,
  };

  static defaultProps = {
    ...InputField.defaultProps,
    allowClear: false,
    allowEmpty: false,
    placeholder: '--',
    escapeMarkup: true,
    multiple: false,
  };

  componentWillUnmount() {
    if (this.select) {
      jQuery(this.select)
        .off('change')
        .select2('destroy');
    }
  }

  onChange = (onBlur, onChange, e) => {
    if (this.props.multiple) {
      let options = e.target.options;
      let value = [];
      for (let i = 0; i < options.length; i++) {
        if (options[i].selected) {
          value.push(options[i].value);
        }
      }
      onChange(value, e);
    } else {
      let value = e.target.value;
      onChange(value, e);

      // Not multplie, also call onBlur to handle saveOnBlur behavior
      onBlur(value, e);
    }
  };

  handleSelectMount = (onBlur, onChange, ref) => {
    if (ref) {
      jQuery(ref)
        .select2(this.getSelect2Options())
        .on('change', this.onChange.bind(this, onBlur, onChange));
    } else {
      jQuery(this.select)
        .select2('destroy')
        .off('change');
    }

    this.select = ref;
  };

  getSelect2Options() {
    return {
      allowClear: this.props.allowClear,
      allowEmpty: this.props.allowEmpty,
      width: 'element',
      escapeMarkup: !this.props.escapeMarkup ? m => m : undefined,
    };
  }

  render() {
    return (
      <InputField
        {...this.props}
        field={({onChange, onBlur, ...props}) => (
          <select
            ref={ref => this.handleSelectMount(onBlur, onChange, ref)}
            style={{width: '100%'}}
            onChange={() => {}}
            value={props.value}
          >
            {(props.choices || []).map(choice => {
              return (
                <option key={choice[0]} value={choice[0]}>
                  {choice[1]}
                </option>
              );
            })}
          </select>
        )}
      />
    );
  }
}
