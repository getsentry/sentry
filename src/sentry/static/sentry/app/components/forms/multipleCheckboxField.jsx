import jQuery from 'jquery';
import React from 'react';
import ReactDOM from 'react-dom';
import FormField from './formField';

export default class MultipleCheckboxField extends FormField {
  static propTypes = {
    ...FormField.propTypes,
    choices: React.PropTypes.array.isRequired
  };

  // XXX(dcramer): this comes from TooltipMixin
  componentDidMount() {
    this.attachTooltips();
  }

  componentWillUnmount() {
    this.removeTooltips();
    jQuery(ReactDOM.findDOMNode(this)).unbind();
  }

  attachTooltips() {
    jQuery('.tip', ReactDOM.findDOMNode(this)).tooltip();
  }

  removeTooltips() {
    jQuery('.tip', ReactDOM.findDOMNode(this)).tooltip('destroy');
  }

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
    let error = this.getError();
    let className = 'control-group';
    if (error) {
      className += ' has-error';
    }
    return (
      <div className={className}>
        <label className="control-label">
          {this.props.label}
          {this.props.disabled &&
            this.props.disabledReason &&
            <span className="disabled-indicator tip" title={this.props.disabledReason}>
              <span className="icon-question" />
            </span>}
        </label>
        {this.props.help && <p className="help-block">{this.props.help}</p>}
        {error && <p className="error">{error}</p>}
        <div className="controls control-list">
          {this.props.choices.map(([value, label]) => {
            return (
              <label className="checkbox" key={value}>
                <input
                  type="checkbox"
                  value={value}
                  onChange={this.onChange.bind(this, value)}
                  disabled={this.props.disabled}
                  checked={this.state.value.indexOf(value) !== -1}
                />
                {label}
              </label>
            );
          })}
        </div>
      </div>
    );
  }
}
