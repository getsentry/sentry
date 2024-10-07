import {Fragment, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import {useFetchIssueTag, useFetchIssueTagValues} from 'sentry/actionCreators/group';
import {openNavigateToExternalLinkModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {DeviceName} from 'sentry/components/deviceName';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import UserBadge from 'sentry/components/idBadge/userBadge';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import TimeSince from 'sentry/components/timeSince';
import {IconArrow, IconEllipsis, IconMail, IconOpen} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group, Tag, TagValue} from 'sentry/types/group';
import {parseCursor} from 'sentry/utils/cursor';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import {isUrl} from 'sentry/utils/string/isUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import {TagBar} from 'sentry/views/issueDetails/groupTags/tagDistribution';
import {useIssueDetailsEventView} from 'sentry/views/issueDetails/streamline/useIssueDetailsDiscoverQuery';

type TagSort = 'date' | 'count';
const DEFAULT_SORT: TagSort = 'count';

export function TagDetailsDrawerContent({group}: {group: Group}) {
  const location = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();
  const {tagKey} = useParams<{tagKey: string}>();
  const sortArrow = <IconArrow color="gray300" size="xs" direction="down" />;

  const sort: TagSort =
    (location.query.tagDrawerSort as TagSort | undefined) ?? DEFAULT_SORT;

  const {
    data: tagValues,
    isError: tagValuesIsError,
    isPending: tagValuesIsPending,
    getResponseHeader,
  } = useFetchIssueTagValues({
    orgSlug: organization.slug,
    groupId: group.id,
    tagKey,
    sort,
    cursor: location.query.tagDrawerCursor as string | undefined,
  });

  const {
    data: tag,
    isError: tagIsError,
    isPending: tagIsPending,
  } = useFetchIssueTag({
    orgSlug: organization.slug,
    groupId: group.id,
    tagKey,
  });

  const isError = tagValuesIsError || tagIsError;
  const isPending = tagValuesIsPending || tagIsPending;

  const currentCursor = parseCursor(location.query?.tagDrawerCursor);
  const start = currentCursor?.offset ?? 0;
  const pageCount = tagValues?.length ?? 0;

  const {cursor: _cursor, page: _page, ...currentQuery} = location.query;

  const paginationCaption = tct('Showing [start]-[end] of [count]', {
    start: start.toLocaleString(),
    end: (start + pageCount).toLocaleString(),
    count: (tag?.uniqueValues ?? 0).toLocaleString(),
  });

  if (isPending) {
    return <LoadingIndicator />;
  }

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
                  tagDrawerCursor: undefined,
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
                  tagDrawerCursor: undefined,
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
            {tagValues.map((tv, i) => (
              <TagDetailsRow
                key={`${tv.value}-${i}`}
                group={group}
                tag={tag}
                tagValue={tv}
              />
            ))}
          </Body>
        </Table>
      )}
      <Pagination
        caption={paginationCaption}
        onCursor={(cursor, path, query) =>
          navigate({
            pathname: path,
            query: {
              ...query,
              tagDrawerCursor: cursor,
            },
          })
        }
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
  const eventView = useIssueDetailsEventView({group, queryProps: query});
  const allEventsLocation = {
    pathname: `/organizations/${organization.slug}/issues/${group.id}/events/`,
    query,
  };

  return (
    <Row onMouseEnter={() => setIsHovered(true)} onMouseLeave={() => setIsHovered(false)}>
      <TagDetailsValue
        valueLocation={allEventsLocation}
        tagKey={key}
        tagValue={tagValue}
      />
      <OverflowTimeSince date={tagValue.lastSeen} />
      <div>{tagValue.count.toLocaleString()}</div>
      {tag.totalValues ? (
        <TagBar
          style={{height: space(2)}}
          count={tagValue.count}
          total={tag.totalValues}
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
            aria-label={t('Tag Value Actions Menu')}
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
            to: allEventsLocation,
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

function TagDetailsValue({
  valueLocation,
  tagKey,
  tagValue,
}: {
  tagKey: string;
  tagValue: TagValue;
  valueLocation: LocationDescriptor;
}) {
  const valueComponent =
    tagKey === 'user' ? (
      <UserBadge user={{...tagValue, id: tagValue.id ?? ''}} avatarSize={20} hideEmail />
    ) : (
      <DeviceName value={tagValue.value} />
    );

  return (
    <Value>
      <ValueLink to={valueLocation}>{valueComponent}</ValueLink>
      {tagValue?.email && (
        <IconLink to={`mailto:${tagValue.email}`}>
          <IconMail size="xs" color="gray300" />
        </IconLink>
      )}
      {isUrl(tagValue.value) && (
        <ExternalLinkbutton
          priority="link"
          icon={<IconOpen />}
          aria-label="Open link"
          size="xs"
          onClick={() => openNavigateToExternalLinkModal({linkText: tagValue.value})}
        />
      )}
    </Value>
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
  white-space: nowrap;
  color: ${p => p.theme.subText};
  font-weight: ${p => p.theme.fontWeightBold};
`;

const ColumnSort = styled(Link)`
  display: flex;
  gap: ${space(0.5)};
  align-items: center;
  white-space: nowrap;
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

const Value = styled('div')`
  display: flex;
  gap: ${space(0.5)};
  align-items: center;
`;

const ValueLink = styled(Link)`
  color: ${p => p.theme.textColor};
  text-decoration: underline;
  text-decoration-style: dotted;
  text-decoration-color: ${p => p.theme.subText};
`;

const IconLink = styled(Link)`
  display: block;
  line-height: 0;
`;

const OverflowTimeSince = styled(TimeSince)`
  white-space: nowrap;
  text-overflow: ellipsis;
  overflow: hidden;
`;

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

const ExternalLinkbutton = styled(Button)`
  color: ${p => p.theme.subText};
`;
