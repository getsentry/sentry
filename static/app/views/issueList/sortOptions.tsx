import * as React from 'react';
import styled from '@emotion/styled';

import Feature from 'app/components/acl/feature';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import {getSortLabel, IssueSortOptions, Query} from 'app/views/issueList/utils';

type Props = {
  sort: string;
  query: string;
  onSelect: (sort: string) => void;
};

export function getSortTooltip(key: IssueSortOptions) {
  switch (key) {
    case IssueSortOptions.INBOX:
      return t('When the issue was flagged for review.');
    case IssueSortOptions.NEW:
      return t('When the issue was first seen in the selected time period.');
    case IssueSortOptions.PRIORITY:
      return t('Issues trending upward recently.');
    case IssueSortOptions.FREQ:
      return t('Number of events in the time selected.');
    case IssueSortOptions.USER:
      return t('Number of users affected in the time selected.');
    case IssueSortOptions.TREND:
      return t('% change in event count over the time selected.');
    case IssueSortOptions.DATE:
    default:
      return t('When the issue was last seen in the selected time period.');
  }
}

const IssueListSortOptions = ({onSelect, sort, query}: Props) => {
  const sortKey = sort || IssueSortOptions.DATE;

  const getMenuItem = (key: IssueSortOptions): React.ReactNode => (
    <DropdownItem onSelect={onSelect} eventKey={key} isActive={sortKey === key}>
      <StyledTooltip
        containerDisplayMode="block"
        position="top"
        delay={500}
        title={getSortTooltip(key)}
      >
        {getSortLabel(key)}
      </StyledTooltip>
    </DropdownItem>
  );

  return (
    <StyledDropdownControl
      buttonProps={{prefix: t('Sort by')}}
      label={getSortLabel(sortKey)}
    >
      <React.Fragment>
        {query === Query.FOR_REVIEW && getMenuItem(IssueSortOptions.INBOX)}
        {getMenuItem(IssueSortOptions.DATE)}
        {getMenuItem(IssueSortOptions.NEW)}
        {getMenuItem(IssueSortOptions.PRIORITY)}
        {getMenuItem(IssueSortOptions.FREQ)}
        {getMenuItem(IssueSortOptions.USER)}
        <Feature features={['issue-list-trend-sort']}>
          {getMenuItem(IssueSortOptions.TREND)}
        </Feature>
      </React.Fragment>
    </StyledDropdownControl>
  );
};

export default IssueListSortOptions;

const StyledTooltip = styled(Tooltip)`
  width: 100%;
`;

const StyledDropdownControl = styled(DropdownControl)`
  z-index: ${p => p.theme.zIndex.issuesList.sortOptions};

  button {
    width: 100%;
  }

  @media (max-width: ${p => p.theme.breakpoints[2]}) {
    order: 2;
  }
`;
