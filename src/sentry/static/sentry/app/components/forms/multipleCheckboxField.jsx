import jQuery from 'jquery';
import React from 'react';
import ReactDOM from 'react-dom';
import FormField from './formField';

export default class MultipleCheckboxField extends FormField {
  constructor(props) {
    super(props);

    this.state.value = new Set(props.value || []);
  }

  // XXX(dcramer): this comes from TooltipMixin
  componentDidMount() {
    this.attachTooltips();
  }

  componentWillUnmount() {
    this.removeTooltips();
    jQuery(ReactDOM.findDOMNode(this)).unbind();
  }

  attachTooltips() {
    jQuery('.tip', ReactDOM.findDOMNode(this))
      .tooltip();
  }

  removeTooltips() {
    jQuery('.tip', ReactDOM.findDOMNode(this))
      .tooltip('destroy');
  }

  onChange(value, e) {
    if (e.target.checked)
      this.state.value.add(value);
    else
      this.state.value.delete(value);
    this.setState({
      value: this.state.value,
    }, () => {
      this.props.onChange(Array.from(this.state.value.keys()));
    });
  }

  render() {
    let className = 'control-group';
    if (this.props.error) {
      className += ' has-error';
    }
    return (
      <div className={className}>
        <label className="control-label">
          {this.props.label}
          {this.props.disabled && this.props.disabledReason &&
            <span className="disabled-indicator tip" title={this.props.disabledReason}>
              <span className="icon-question" />
            </span>
          }
        </label>
        {this.props.help &&
          <p className="help-block">{this.props.help}</p>
        }
        <div className="controls control-list">
          {this.props.choices.map((choice) => {
            return (
              <label className="checkbox" key={choice[0]}>
                <input type="checkbox"
                       value={choice[0]}
                       onChange={this.onChange.bind(this, choice[0])}
                       disabled={this.props.disabled}
                       checked={this.state.value.has(choice[0])} />
                {choice[1]}
              </label>
            );
          })}
        </div>
      </div>
    );
  }
}
