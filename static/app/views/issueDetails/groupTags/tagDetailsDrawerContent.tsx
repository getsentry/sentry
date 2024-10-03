import {Fragment, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {useFetchIssueTag, useFetchIssueTagValues} from 'sentry/actionCreators/group';
import {Button} from 'sentry/components/button';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import Pagination from 'sentry/components/pagination';
import TimeSince from 'sentry/components/timeSince';
import {IconArrow, IconEllipsis} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group, Tag, TagValue} from 'sentry/types/group';
import {percent} from 'sentry/utils';
import {parseCursor} from 'sentry/utils/cursor';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import {TagBar} from 'sentry/views/issueDetails/groupTags/tagDistribution';
import {useIssueDetailsEventView} from 'sentry/views/issueDetails/streamline/useIssueDetailsDiscoverQuery';

type TagSort = 'date' | 'count';
const DEFAULT_SORT: TagSort = 'count';

export function TagDetailsDrawerContent({group}: {group: Group}) {
  const location = useLocation();
  const organization = useOrganization();
  const {tagKey} = useParams<{tagKey: string}>();
  const sortArrow = <IconArrow color="gray300" size="xs" direction="down" />;

  const sort: TagSort =
    (location.query.tagDrawerSort as TagSort | undefined) ?? DEFAULT_SORT;

  const {
    data: tagValues,
    isError: tagValuesListIsError,
    getResponseHeader,
  } = useFetchIssueTagValues({
    orgSlug: organization.slug,
    groupId: group.id,
    tagKey,
    sort,
    cursor: location.query.cursor as string | undefined,
  });

  const {data: tag, isError: tagIsError} = useFetchIssueTag({
    orgSlug: organization.slug,
    groupId: group.id,
    tagKey,
  });

  const isError = tagIsError || tagValuesListIsError;

  const currentCursor = parseCursor(location.query?.cursor);
  const start = currentCursor?.offset ?? 0;
  const pageCount = tagValues?.length ?? 0;
  const {cursor: _cursor, page: _page, ...currentQuery} = location.query;

  const paginationCaption = tct('Showing [start]-[end] of [count]', {
    start: start.toLocaleString(),
    end: (start + pageCount).toLocaleString(),
    count: (tag?.uniqueValues ?? 0).toLocaleString(),
  });

  if (isError) {
    return <LoadingError message={t('There was an error loading tag details')} />;
  }

  return (
    <Fragment>
      {tag && tagValues?.length && (
        <Table>
          <Header>
            <ColumnTitle>{t('Value')}</ColumnTitle>
            <ColumnSort
              to={{
                pathname: location.pathname,
                query: {
                  ...currentQuery,
                  cursor: undefined,
                  tagDrawerSort: 'date',
                },
              }}
            >
              {sort === 'date' && sortArrow}
              {t('Last Seen')}
            </ColumnSort>
            <ColumnSort
              to={{
                pathname: location.pathname,
                query: {
                  ...currentQuery,
                  cursor: undefined,
                  tagDrawerSort: 'count',
                },
              }}
            >
              {sort === 'count' && sortArrow}
              {t('Count')}
            </ColumnSort>
            <ColumnTitle>{t('Percentage')}</ColumnTitle>
          </Header>
          <Body>
            {tagValues.map(tv => (
              <TagDetailsRow key={tv.key} group={group} tag={tag} tagValue={tv} />
            ))}
          </Body>
        </Table>
      )}
      <Pagination
        caption={paginationCaption}
        size="xs"
        pageLinks={getResponseHeader?.('Link')}
      />
    </Fragment>
  );
}

function TagDetailsRow({
  group,
  tag,
  tagValue,
}: {
  group: Group;
  tag: Tag;
  tagValue: TagValue;
}) {
  const organization = useOrganization();
  const [isHovered, setIsHovered] = useState(false);
  const key = tagValue.key ?? tag.key;
  const query = {query: tagValue.query || `${key}:"${tagValue.value}"`};
  const percentage = tag.totalValues ? percent(tagValue.count, tag.totalValues) : NaN;
  const displayPercentage =
    !isNaN(percentage) && percentage < 1 ? '<1%' : `${percentage.toFixed(0)}%`;
  const eventView = useIssueDetailsEventView({group, queryProps: query});

  return (
    <Row onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <Value>{tagValue.value}</Value>
      <Value>
        <TimeSince date={tagValue.lastSeen} />
      </Value>
      <Value>{tagValue.count.toLocaleString()}</Value>
      {!isNaN(percentage) ? (
        <TagBar
          style={{height: space(2)}}
          displayPercentage={displayPercentage}
          widthPercent={percentage}
        />
      ) : (
        '--'
      )}
      <DropdownMenu
        size="xs"
        trigger={triggerProps => (
          <ActionButton
            {...triggerProps}
            isHidden={!isHovered}
            size="xs"
            icon={<IconEllipsis />}
            aria-label={t('Tag Details Actions Menu')}
          />
        )}
        items={[
          {
            key: 'open-in-discover',
            label: t('Open in Discover'),
            to: eventView.getResultsViewUrlTarget(
              organization.slug,
              false,
              hasDatasetSelector(organization) ? SavedQueryDatasets.ERRORS : undefined
            ),
            hidden: !group || !organization.features.includes('discover-basic'),
          },
          {
            key: 'view-events',
            label: t('View other events with this tag value'),
            to: {
              pathname: `/organizations/${organization.slug}/issues/${group.id}/events/`,
              query,
            },
          },
          {
            key: 'view-issues',
            label: t('View issues with this tag value'),
            to: {
              pathname: `/organizations/${organization.slug}/issues/`,
              query,
            },
          },
        ]}
      />
    </Row>
  );
}

const Table = styled('div')`
  display: grid;
  grid-template-columns: repeat(3, auto) 1fr auto;
  column-gap: ${space(2)};
  row-gap: ${space(0.5)};
  margin: 0 -${space(1)};
`;

const ColumnTitle = styled('div')`
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const ColumnSort = styled(Link)`
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeightBold};
  text-decoration: underline;
  text-decoration-style: dotted;
  text-decoration-color: ${p => p.theme.textColor};
  &:hover {
    color: ${p => p.theme.subText};
  }
`;

const Body = styled('div')`
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
`;

const Header = styled(Body)`
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  border-bottom: 1px solid ${p => p.theme.border};
  margin: 0 ${space(1)};
`;

const Row = styled(Body)`
  &:nth-child(even) {
    background: ${p => p.theme.backgroundSecondary};
  }
  align-items: center;
  border-radius: 4px;
  padding: ${space(0.25)} ${space(1)};
`;

const Value = styled('div')``;

// We need to do the hiding here so that focus styles from the `Button` component take precedent
const ActionButton = styled(Button)<{isHidden: boolean}>`
  ${p =>
    p.isHidden &&
    css`
      border: 0;
      color: transparent;
      background: transparent;
    `}
`;
