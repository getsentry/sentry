import Feature from 'sentry/components/acl/feature';
import CompactSelect from 'sentry/components/compactSelect';
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
      return t('When issue was flagged for review.');
    case IssueSortOptions.NEW:
      return t('First time the issue occurred.');
    case IssueSortOptions.PRIORITY:
      return t('Recent issues trending upward.');
    case IssueSortOptions.FREQ:
      return t('Number of events.');
    case IssueSortOptions.USER:
      return t('Number of users affected.');
    case IssueSortOptions.TREND:
      return t('% change in event count.');
    case IssueSortOptions.DATE:
    default:
      return t('Last time the issue occurred.');
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
    details: getSortTooltip(key),
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
          size="sm"
          onChange={opt => onSelect(opt.value)}
          options={getSortOptions(sortKeys, hasTrendSort)}
          value={sortKey}
          triggerProps={{
            size: 'xs',
            icon: <IconSort size="xs" />,
          }}
        />
      )}
    </Feature>
  );
};

export default IssueListSortOptions;
