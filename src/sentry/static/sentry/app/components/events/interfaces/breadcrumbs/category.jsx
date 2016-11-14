import React from 'react';

const Category = React.createClass({
  propTypes: {
    value: React.PropTypes.string,
    title: React.PropTypes.string,
    hideIfEmpty: React.PropTypes.bool
  },

  render() {
    let value = this.props.value;
    if (!value) {
      value = 'generic';
      if (this.props.hideIfEmpty) {
        return null;
      }
    }
    let title = this.props.title;
    if (title) {
      title = title.replace('%s', value);
    } else {
      title = value;
    }
    return (
      <span className="crumb-category" title={title}>{title}</span>
    );
  }
});

export default Category;
