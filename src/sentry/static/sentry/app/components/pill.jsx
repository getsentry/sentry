import React from 'react';


const Pill = React.createClass({
  propTypes: {
    className: React.PropTypes.string,
    name: React.PropTypes.string,
    value: React.PropTypes.any,
  },

  renderValue() {
    const {value} = this.props;
    if (value === undefined) {
      return [null, null];
    }
    let extraClass = null;
    let renderedValue;
    if (value === true || value === false) {
      extraClass = value ? 'true' : 'false';
      renderedValue = value ? 'yes' : 'no';
    } else if (value === null) {
      extraClass = 'false';
      renderedValue = 'n/a';
    } else {
      renderedValue = value.toString();
    }
    return [extraClass, renderedValue];
  },

  render() {
    const {name, value, children, className, ...props} = this.props;
    let [extraClass, renderedValue] = this.renderValue();

    return (
      <li className={
        (className || '') + (extraClass ? ' ' + extraClass : '')} {...props}>
        <span className="key">{name}</span>
        <span className="value">{renderedValue}{children}</span>
      </li>
    );
  }
});

export default Pill;
