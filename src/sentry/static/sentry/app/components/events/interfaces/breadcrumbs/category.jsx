import PropTypes from 'prop-types';
import React from 'react';

class Category extends React.Component {
  static propTypes = {
    value: PropTypes.string,
    title: PropTypes.string,
    hideIfEmpty: PropTypes.bool,
  };

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
      <span className="crumb-category" title={title}>
        {title}
      </span>
    );
  }
}

export default Category;
