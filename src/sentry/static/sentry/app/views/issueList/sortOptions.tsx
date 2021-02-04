import React from 'react';
import styled from '@emotion/styled';

import Feature from 'app/components/acl/feature';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import {t} from 'app/locale';
import {isForReviewQuery, IssueSortOptions} from 'app/views/issueList/utils';

type Props = {
  sort: string;
  query: string;
  onSelect: (sort: string) => void;
};

const IssueListSortOptions = ({onSelect, sort, query}: Props) => {
  const sortKey = sort || IssueSortOptions.DATE;

  const getSortLabel = (key: string) => {
    switch (key) {
      case IssueSortOptions.NEW:
        return t('First Seen');
      case IssueSortOptions.PRIORITY:
        return t('Priority');
      case IssueSortOptions.FREQ:
        return t('Events');
      case IssueSortOptions.USER:
        return t('Users');
      case IssueSortOptions.TREND:
        return t('Relative Change');
      case IssueSortOptions.INBOX:
        return t('Time');
      case IssueSortOptions.DATE:
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
      {getMenuItem(IssueSortOptions.PRIORITY)}
      {getMenuItem(IssueSortOptions.DATE)}
      {getMenuItem(IssueSortOptions.NEW)}
      {getMenuItem(IssueSortOptions.FREQ)}
      {getMenuItem(IssueSortOptions.USER)}
      <Feature features={['issue-list-trend-sort']}>
        {getMenuItem(IssueSortOptions.TREND)}
      </Feature>
      <Feature features={['inbox']}>
        {isForReviewQuery(query) && getMenuItem(IssueSortOptions.INBOX)}
      </Feature>
    </StyledDropdownControl>
  );
};

export default IssueListSortOptions;

const StyledDropdownControl = styled(DropdownControl)`
  min-width: 140px;
`;
