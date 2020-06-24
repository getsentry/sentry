import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';

import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import {t} from 'app/locale';
import space from 'app/styles/space';

type Props = {
  sort?: string;
  onSelect?: (sort: string) => void;
};

class IssueListSortOptions extends React.PureComponent<Props> {
  static propTypes = {
    sort: PropTypes.string,
    onSelect: PropTypes.func,
  };

  getMenuItem = (key: string, sortKey: string): React.ReactNode => (
    <DropdownItem onSelect={this.onSelect} eventKey={key} isActive={sortKey === key}>
      {this.getSortLabel(key)}
    </DropdownItem>
  );

  onSelect = (sort: string) => {
    this.props.onSelect?.(sort);
  };

  getSortLabel = (key: string) => {
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
    const sortKey = this.props.sort || 'date';

    return (
      <Container>
        <DropdownControl
          buttonProps={{prefix: t('Sort by')}}
          label={this.getSortLabel(sortKey)}
        >
          {this.getMenuItem('priority', sortKey)}
          {this.getMenuItem('date', sortKey)}
          {this.getMenuItem('new', sortKey)}
          {this.getMenuItem('freq', sortKey)}
          {this.getMenuItem('user', sortKey)}
        </DropdownControl>
      </Container>
    );
  }
}

const Container = styled('div')`
  margin-right: ${space(0.5)};
`;

export default IssueListSortOptions;
