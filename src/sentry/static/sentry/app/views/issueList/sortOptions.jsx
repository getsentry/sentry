import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import {t} from 'app/locale';
import space from 'app/styles/space';

class IssueListSortOptions extends React.PureComponent {
  static propTypes = {
    sort: PropTypes.string,
    onSelect: PropTypes.func,
  };

  constructor(...args) {
    super(...args);
    this.state = {
      sortKey: this.props.sort || 'date',
    };
  }

  UNSAFE_componentWillReceiveProps(nextProps) {
    this.setState({
      sortKey: nextProps.sort || 'date',
    });
  }

  getMenuItem = key => (
    <DropdownItem
      onSelect={this.onSelect}
      eventKey={key}
      isActive={this.state.sortKey === key}
    >
      {this.getSortLabel(key)}
    </DropdownItem>
  );

  onSelect = sort => {
    this.setState({sortKey: sort});
    if (this.props.onSelect) {
      this.props.onSelect(sort);
    }
  };

  getSortLabel = key => {
    switch (key) {
      case 'new':
        return t('First Seen');
      case 'priority':
        return t('Priority');
      case 'freq':
        return t('Frequency');
      case 'user':
        return t('Users');
      case 'date':
      default:
        return t('Last Seen');
    }
  };

  render() {
    return (
      <Container>
        <DropdownControl
          buttonProps={{prefix: t('Sort by')}}
          label={this.getSortLabel(this.state.sortKey)}
        >
          {this.getMenuItem('priority')}
          {this.getMenuItem('date')}
          {this.getMenuItem('new')}
          {this.getMenuItem('freq')}
          {this.getMenuItem('user')}
        </DropdownControl>
      </Container>
    );
  }
}

const Container = styled('div')`
  margin-right: ${space(0.5)};
`;

export default IssueListSortOptions;
