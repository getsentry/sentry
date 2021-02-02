import React from 'react';
import styled from '@emotion/styled';

import Feature from 'app/components/acl/feature';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import {t} from 'app/locale';
import {isForReviewQuery} from 'app/views/issueList/utils';

type Props = {
  sort: string;
  query: string;
  onSelect: (sort: string) => void;
};

const IssueListSortOptions = ({onSelect, sort, query}: Props) => {
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
      case 'trend':
        return t('Relative Change');
      case 'time':
        return t('Time');
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
    <StyledDropdownControl
      buttonProps={{prefix: t('Sort by')}}
      label={getSortLabel(sortKey)}
    >
      {getMenuItem('priority')}
      {getMenuItem('date')}
      {getMenuItem('new')}
      {getMenuItem('freq')}
      {getMenuItem('user')}
      <Feature features={['issue-list-trend-sort']}>{getMenuItem('trend')}</Feature>
      <Feature features={['inbox']}>
        {isForReviewQuery(query) && getMenuItem('time')}
      </Feature>
    </StyledDropdownControl>
  );
};

export default IssueListSortOptions;

const StyledDropdownControl = styled(DropdownControl)`
  min-width: 140px;
`;
