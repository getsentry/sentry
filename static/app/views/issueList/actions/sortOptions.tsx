import {CompactSelect} from 'sentry/components/compactSelect';
import type {DropdownButtonProps} from 'sentry/components/dropdownButton';
import {IconSort} from 'sentry/icons/iconSort';
import {t} from 'sentry/locale';
import {
  FOR_REVIEW_QUERIES,
  getSortLabel,
  IssueSortOptions,
} from 'sentry/views/issueList/utils';

type Props = {
  onSelect: (sort: string) => void;
  query: string;
  sort: string;
  className?: string;
  showIcon?: boolean;
  triggerSize?: DropdownButtonProps['size'];
};

function getSortTooltip(key: IssueSortOptions) {
  switch (key) {
    case IssueSortOptions.INBOX:
      return t('When issue was flagged for review.');
    case IssueSortOptions.NEW:
      return t('First time the issue occurred.');
    case IssueSortOptions.TRENDS:
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

function IssueListSortOptions({
  className,
  onSelect,
  sort,
  query,
  triggerSize = 'xs',
  showIcon = true,
}: Props) {
  const sortKey = sort || IssueSortOptions.DATE;
  const sortKeys = [
    ...(FOR_REVIEW_QUERIES.includes(query || '') ? [IssueSortOptions.INBOX] : []),
    IssueSortOptions.DATE,
    IssueSortOptions.NEW,
    IssueSortOptions.TRENDS,
    IssueSortOptions.FREQ,
    IssueSortOptions.USER,
  ];

  return (
    <CompactSelect
      className={className}
      size="md"
      onChange={opt => onSelect(opt.value)}
      options={sortKeys.map(key => ({
        value: key,
        label: getSortLabel(key),
        details: getSortTooltip(key),
      }))}
      menuWidth={240}
      value={sortKey}
      triggerProps={{
        size: triggerSize,
        icon: showIcon && <IconSort />,
      }}
    />
  );
}

export default IssueListSortOptions;
