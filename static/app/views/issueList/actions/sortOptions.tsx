import {CompactSelect} from 'sentry/components/compactSelect';
import {IconSort} from 'sentry/icons/iconSort';
import {t} from 'sentry/locale';
import {enablePrioritySortByDefault} from 'sentry/utils/prioritySort';
import useOrganization from 'sentry/utils/useOrganization';
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
    case IssueSortOptions.BETTER_PRIORITY:
      return t('Recent issues trending upward.');
    case IssueSortOptions.FREQ:
      return t('Number of events.');
    case IssueSortOptions.USER:
      return t('Number of users affected.');
    case IssueSortOptions.DATE:
    default:
      return t('Last time the issue occurred.');
  }
}

function IssueListSortOptions({onSelect, sort, query}: Props) {
  const organization = useOrganization();
  const hasBetterPrioritySort = enablePrioritySortByDefault(organization);
  const sortKey = sort || IssueSortOptions.DATE;
  const sortKeys = [
    ...(hasBetterPrioritySort ? [IssueSortOptions.BETTER_PRIORITY] : []), // show better priority for EA orgs
    ...(query === Query.FOR_REVIEW ? [IssueSortOptions.INBOX] : []),
    IssueSortOptions.DATE,
    IssueSortOptions.NEW,
    ...(hasBetterPrioritySort ? [] : [IssueSortOptions.PRIORITY]), // hide regular priority for EA orgs
    IssueSortOptions.FREQ,
    IssueSortOptions.USER,
  ];

  return (
    <CompactSelect
      size="sm"
      onChange={opt => onSelect(opt.value)}
      options={sortKeys.map(key => ({
        value: key,
        label: getSortLabel(key),
        details: getSortTooltip(key),
      }))}
      value={sortKey}
      triggerProps={{
        size: 'xs',
        icon: <IconSort size="xs" />,
      }}
    />
  );
}

export default IssueListSortOptions;
