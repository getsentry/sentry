import React from "react";

var Classifier = React.createClass({
  propTypes: {
    value: React.PropTypes.string.isRequired,
    prefix: React.PropTypes.string,
    title: React.PropTypes.string,
  },

  render() {
    var value = this.props.value;
    if (!value) {
      value = 'generic';
    } else if (this.props.prefix) {
      if (value.substr(0, this.props.prefix.length + 1) == this.props.prefix + '.') {
        value = value.substr(this.props.prefix.length + 1);
      } else if (value == this.props.prefix) {
        value = 'generic';
      }
    }
    var title = this.props.title;
    if (title) {
      title = title.replace('%s', value);
    } else {
      title = value;
    }
    return (
      <span className="crumb-classifier">({title})</span>
    );
  }
});

export default Classifier;
