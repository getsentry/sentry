import PureRenderMixin from 'react-addons-pure-render-mixin';
import React from 'react';
import DropdownLink from '../../components/dropdownLink';
import MenuItem from '../../components/menuItem';
import {t} from '../../locale';

const SortOptions = React.createClass({
  propTypes: {
    sort: React.PropTypes.string,
    onSelect: React.PropTypes.func
  },

  mixins: [PureRenderMixin],

  getInitialState() {
    return {
      sortKey: this.props.sort || 'date'
    };
  },

  componentWillReceiveProps(nextProps) {
    this.setState({
      sortKey: nextProps.sort || 'date',
    });
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
        return t('First Seen');
      case 'priority':
        return t('Priority');
      case 'freq':
        return t('Frequency');
      case 'date':
      default:
        return t('Last Seen');
    }
  },

  render() {
    let dropdownTitle = (
      <span>
        <strong>{t('Sort by')}:</strong>
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

