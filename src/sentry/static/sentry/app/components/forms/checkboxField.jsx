import jQuery from 'jquery';
import React from 'react';
import ReactDOM from 'react-dom';
import FormField from './formField';

export default class CheckboxField extends FormField {
  constructor(props) {
    super(props);

    this.state.value = (
      props.value ? true : false
    );
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

  onChange(e) {
    this.setState({
      value: e.target.checked,
    }, () => {
      this.props.onChange(this.state.value);
    });
  }

  render() {
    return (
      <div className="checkbox">
        <label>
          <input type="checkbox"
                 onChange={this.onChange.bind(this)}
                 disabled={this.props.disabled}
                 checked={this.props.value} />
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
      </div>
    );
  }
}
