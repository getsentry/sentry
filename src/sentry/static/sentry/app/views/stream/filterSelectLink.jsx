import React from "react";

const FilterSelectLink = React.createClass({
  propTypes: {
    label: React.PropTypes.string,
    onSelect: React.PropTypes.func,
    extraClass: React.PropTypes.string
  },

  onSelect() {
    if (this.props.onSelect) {
      this.props.onSelect();
    }
  },

  render() {
    let className = this.props.extraClass;

    if (this.props.isActive) {
      className += ' active';
    }

    return (
      <a className={className} onClick={this.onSelect}>
        {this.props.label}
      </a>
    );
  }
});

export default FilterSelectLink;
