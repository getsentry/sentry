import Feature from 'sentry/components/acl/feature';
import CompactSelect from 'sentry/components/forms/compactSelect';
import {IconSort} from 'sentry/icons/iconSort';
import {t} from 'sentry/locale';
import {getSortLabel, IssueSortOptions, Query} from 'sentry/views/issueList/utils';

type Props = {
  onSelect: (sort: string) => void;
  query: string;
  sort: string;
};

function getSortTooltip(key: IssueSortOptions) {
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

function getSortOptions(sortKeys: IssueSortOptions[], hasTrendSort = false) {
  const combinedSortKeys = [
    ...sortKeys,
    ...(hasTrendSort ? [IssueSortOptions.TREND] : []),
  ];
  return combinedSortKeys.map(key => ({
    value: key,
    label: getSortLabel(key),
    tooltip: getSortTooltip(key),
  }));
}

const IssueListSortOptions = ({onSelect, sort, query}: Props) => {
  const sortKey = sort || IssueSortOptions.DATE;
  const sortKeys = [
    ...(query === Query.FOR_REVIEW ? [IssueSortOptions.INBOX] : []),
    IssueSortOptions.DATE,
    IssueSortOptions.NEW,
    IssueSortOptions.PRIORITY,
    IssueSortOptions.FREQ,
    IssueSortOptions.USER,
  ];

  return (
    <Feature features={['issue-list-trend-sort']}>
      {({hasFeature: hasTrendSort}) => (
        <CompactSelect
          onChange={opt => onSelect(opt.value)}
          options={getSortOptions(sortKeys, hasTrendSort)}
          value={sortKey}
          triggerProps={{
            size: 'xsmall',
            icon: <IconSort size="xs" />,
          }}
        />
      )}
    </Feature>
  );
};

export default IssueListSortOptions;
