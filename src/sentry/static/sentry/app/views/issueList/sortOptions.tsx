import PropTypes from 'prop-types';
import * as React from 'react';
import styled from '@emotion/styled';

import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import {t} from 'app/locale';
import space from 'app/styles/space';

type Props = {
  sort: string;
  onSelect: (sort: string) => void;
};

const IssueListSortOptions = ({onSelect, sort}: Props) => {
  const sortKey = sort || 'date';

  const getSortLabel = (key: string) => {
    switch (key) {
      case 'new':
        return t('First Seen');
      case 'priority':
        return t('Priority');
      case 'freq':
        return t('Events');
      case 'user':
        return t('Users');
      case 'date':
      default:
        return t('Last Seen');
    }
  };

  const getMenuItem = (key: string): React.ReactNode => (
    <DropdownItem onSelect={onSelect} eventKey={key} isActive={sortKey === key}>
      {getSortLabel(key)}
    </DropdownItem>
  );

  return (
    <Container>
      <DropdownControl buttonProps={{prefix: t('Sort by')}} label={getSortLabel(sortKey)}>
        {getMenuItem('priority')}
        {getMenuItem('date')}
        {getMenuItem('new')}
        {getMenuItem('freq')}
        {getMenuItem('user')}
      </DropdownControl>
    </Container>
  );
};

IssueListSortOptions.propTypes = {
  sort: PropTypes.string.isRequired,
  onSelect: PropTypes.func.isRequired,
};

const Container = styled('div')`
  margin-right: ${space(0.5)};
`;

export default IssueListSortOptions;
