var PureRenderMixin = require('react/addons').addons.PureRenderMixin;
import React from "react";
import DropdownLink from "../../components/dropdownLink";
import MenuItem from "../../components/menuItem";

var SortOptions = React.createClass({
  mixins: [PureRenderMixin],

  getInitialState() {
    return {
      sortKey: this.props.sort || 'date'
    };
  },

  getMenuItem(key) {
    return (
      <MenuItem onSelect={this.onSelect} eventKey={key} isActive={this.state.sortKey === key}>
        {this.getSortLabel(key)}
      </MenuItem>
    );
  },

  onSelect(sort) {
    this.setState({sortKey: sort});
    if (this.props.onSelect) {
      this.props.onSelect(sort);
    }
  },

  getSortLabel(key) {
    switch (key) {
      case 'new':
        return 'First Seen';
      case 'priority':
        return 'Priority';
      case 'freq':
        return 'Frequency';
      case 'date':
      default:
        return 'Last Seen';
    }
  },

  render() {
    var dropdownTitle = (
      <span>
        <span>Sort by:</span>
        &nbsp; {this.getSortLabel(this.state.sortKey)}
      </span>
    );

    return (
      <DropdownLink
          btnGroup={true}
          title={dropdownTitle}>
        {this.getMenuItem('priority')}
        {this.getMenuItem('date')}
        {this.getMenuItem('new')}
        {this.getMenuItem('freq')}
      </DropdownLink>
    );
  }
});

export default SortOptions;

