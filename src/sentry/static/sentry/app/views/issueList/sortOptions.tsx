import React from 'react';

import Feature from 'app/components/acl/feature';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import {t} from 'app/locale';
import {
  getSortLabel,
  isForReviewQuery,
  IssueSortOptions,
} from 'app/views/issueList/utils';

type Props = {
  sort: string;
  query: string;
  onSelect: (sort: string) => void;
};

const IssueListSortOptions = ({onSelect, sort, query}: Props) => {
  const sortKey = sort || IssueSortOptions.DATE;

  const getMenuItem = (key: string): React.ReactNode => (
    <DropdownItem onSelect={onSelect} eventKey={key} isActive={sortKey === key}>
      {getSortLabel(key)}
    </DropdownItem>
  );

  return (
    <DropdownControl buttonProps={{prefix: t('Sort by')}} label={getSortLabel(sortKey)}>
      <React.Fragment>
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
      </React.Fragment>
    </DropdownControl>
  );
};

export default IssueListSortOptions;
