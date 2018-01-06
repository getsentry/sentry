import PropTypes from 'prop-types';
import React from 'react';
import jQuery from 'jquery';
import cx from 'classnames';
import {css} from 'react-emotion';

import InputField from './inputField';

const selectCss = css`
  width: 50%;
  font-size: 1.1rem;
  font-weight: bold;
  padding: 0.33em 0.75em;

  .select2-arrow:after {
    font-size: 1.4rem;
    color: #ccc;
    margin-top: 0.125em;
  }
`;

export default class Select2Field extends React.Component {
  static propTypes = {
    ...InputField.propTypes,
    choices: PropTypes.oneOfType([PropTypes.array, PropTypes.func]).isRequired,
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
    if (!this.select) return;

    this.select = null;
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

  // Note: mouse hovers will trigger re-render, and re-mounts the native `select` element
  // This will cause an infinite loop because hover state causes re-render, and then we call $.select2, which
  // genenerates a new element which will then cause a new hover event.
  //
  // HOWEVER we need this behavior because we may re-render from an event and during reconciliation we'll have
  // an additional native `select` (e.g. when we save an org setting field)
  //
  // Handle this right now by disabling hover state completely
  handleSelectMount = (onBlur, onChange, ref) => {
    if (ref && !this.select) {
      jQuery(ref)
        .select2(this.getSelect2Options())
        .on('change', this.onChange.bind(this, onBlur, onChange));
    } else if (!ref) {
      jQuery(this.select)
        .off('change')
        .select2('destroy');
    }

    this.select = ref;
  };

  getSelect2Options() {
    return {
      allowClear: this.props.allowClear,
      allowEmpty: this.props.allowEmpty,
      width: 'element',
      escapeMarkup: !this.props.escapeMarkup ? m => m : undefined,
      minimumResultsForSearch: 5,
    };
  }

  render() {
    return (
      <InputField
        {...this.props}
        alignRight={true}
        field={({onChange, onBlur, disabled, ...props}) => {
          let choices = props.choices || [];

          if (typeof props.choices === 'function') {
            choices = props.choices(props);
          }

          return (
            <select
              disabled={disabled}
              className={cx(selectCss, 'form-control')}
              ref={ref => this.handleSelectMount(onBlur, onChange, ref)}
              onChange={() => {}}
              value={props.value}
            >
              {choices.map(choice => {
                return (
                  <option key={choice[0]} value={choice[0]}>
                    {choice[1]}
                  </option>
                );
              })}
            </select>
          );
        }}
      />
    );
  }
}
