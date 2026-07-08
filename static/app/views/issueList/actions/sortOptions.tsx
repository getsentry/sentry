import {FeatureBadge} from '@sentry/scraps/badge';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import type {DropdownButtonProps} from 'sentry/components/dropdownButton';
import {IconSort} from 'sentry/icons/iconSort';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
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
    case IssueSortOptions.RECOMMENDED:
      return t('Issues ranked by combined recency, severity, and impact signals.');
    case IssueSortOptions.RECOMMENDED_EXPERIMENTAL:
      return t(
        'Experimental recommended sort with additional relevance and lifecycle signals.'
      );
    case IssueSortOptions.PROGRESS:
      return t('Issues ranked by how far along they are toward a fix.');
    case IssueSortOptions.DATE:
    default:
      return t('Last time the issue occurred.');
  }
}

export function IssueListSortOptions({
  className,
  onSelect,
  sort,
  query,
  triggerSize = 'xs',
  showIcon = true,
}: Props) {
  const organization = useOrganization();
  const hasRecommendedSort =
    organization.features.includes('issue-stream-recommended-sort') ||
    // If Recommended is the default sort it must also be selectable, otherwise a
    // user with a stored non-recommended sort can't switch back to it.
    organization.features.includes('issue-stream-recommended-sort-default') ||
    sort === IssueSortOptions.RECOMMENDED;
  const hasExperimentalRecommendedSort =
    organization.features.includes('issue-stream-recommended-sort-experimental') ||
    sort === IssueSortOptions.RECOMMENDED_EXPERIMENTAL;
  const hasProgressSort =
    organization.features.includes('issue-stream-progress-sort') ||
    sort === IssueSortOptions.PROGRESS;
  const sortKey = sort || IssueSortOptions.DATE;
  const sortKeys = [
    ...(FOR_REVIEW_QUERIES.includes(query || '') ? [IssueSortOptions.INBOX] : []),
    IssueSortOptions.DATE,
    IssueSortOptions.NEW,
    IssueSortOptions.TRENDS,
    IssueSortOptions.FREQ,
    IssueSortOptions.USER,
    ...(hasRecommendedSort ? [IssueSortOptions.RECOMMENDED] : []),
    ...(hasExperimentalRecommendedSort
      ? [IssueSortOptions.RECOMMENDED_EXPERIMENTAL]
      : []),
    ...(hasProgressSort ? [IssueSortOptions.PROGRESS] : []),
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
      trigger={triggerProps => (
        <OverlayTrigger.Button
          {...triggerProps}
          size={triggerSize}
          icon={showIcon && <IconSort />}
        >
          {organization.features.includes('issue-stream-recommended-sort-default') &&
          sortKey === IssueSortOptions.RECOMMENDED ? (
            <Flex as="span" gap="sm" align="center">
              {triggerProps.children}
              <FeatureBadge
                type="new"
                tooltipProps={{
                  position: 'bottom',
                  title: (
                    <Text as="div" align="left">
                      {t(
                        "Issues now default to the Recommended sort. Pick a different sort and we'll remember your choice."
                      )}
                    </Text>
                  ),
                }}
              />
            </Flex>
          ) : (
            triggerProps.children
          )}
        </OverlayTrigger.Button>
      )}
    />
  );
}
