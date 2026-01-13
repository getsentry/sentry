import {Fragment, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {LocationDescriptor} from 'history';

import {useFetchIssueTag, useFetchIssueTagValues} from 'sentry/actionCreators/group';
import {openNavigateToExternalLinkModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import {DeviceName} from 'sentry/components/deviceName';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import {getContextIcon} from 'sentry/components/events/contexts/utils';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import TimeSince from 'sentry/components/timeSince';
import {IconArrow, IconEllipsis, IconOpen} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Group, Tag, TagValue} from 'sentry/types/group';
import {escapeIssueTagKey, generateQueryWithTag, percent} from 'sentry/utils';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import {isUrl} from 'sentry/utils/string/isUrl';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import {TagBar} from 'sentry/views/issueDetails/groupTags/tagDistribution';
import {useIssueDetailsEventView} from 'sentry/views/issueDetails/streamline/hooks/useIssueDetailsDiscoverQuery';
import {getUserTagValue} from 'sentry/views/issueDetails/utils';

type TagSort = 'date' | 'count';
const DEFAULT_SORT: TagSort = 'count';

export function TagDetailsDrawerContent({group}: {group: Group}) {
  const location = useLocation();
  const navigate = useNavigate();
  const organization = useOrganization();
  const {tagKey} = useParams<{tagKey: string}>();
  const sortArrow = <IconArrow variant="muted" size="xs" direction="down" />;

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

  const {cursor: _cursor, page: _page, ...currentQuery} = location.query;
  const paginationCaption = tct('[count] results', {
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
            <ShareColumnTitle>{t('Share')}</ShareColumnTitle>
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
  const location = useLocation();

  const key = tagValue.key ?? tag.key;
  const query =
    key === 'environment'
      ? {
          environment: tagValue.value,
          query: undefined,
        }
      : {
          query: tagValue.query || `${key}:"${tagValue.value}"`,
        };

  const allEventsLocation = {
    pathname: `/organizations/${organization.slug}/issues/${group.id}/events/recommended/`,
    query: {
      ...location.query,
      ...query,
    },
  };
  const percentage = Math.round(percent(tagValue.count ?? 0, tag.totalValues ?? 0));
  // Ensure no item shows 100% when there are multiple tag values
  const hasMultipleItems = (tag.uniqueValues ?? 0) > 1;
  const cappedPercentage = hasMultipleItems && percentage >= 100 ? 99 : percentage;
  const displayPercentage =
    cappedPercentage < 1
      ? '<1%'
      : hasMultipleItems && percentage >= 100
        ? '>99%'
        : `${cappedPercentage.toFixed(0)}%`;

  return (
    <Row>
      <TagDetailsValue
        valueLocation={allEventsLocation}
        tagKey={key}
        tagValue={tagValue}
      />
      <OverflowTimeSince date={tagValue.lastSeen} />
      <RightAlignedValue>{tagValue.count.toLocaleString()}</RightAlignedValue>
      <RightAlignedValue>{displayPercentage}</RightAlignedValue>
      {tag.totalValues ? (
        <TagBar percentage={percentage} style={{height: space(1.5)}} />
      ) : (
        '--'
      )}
      <TagValueActionsMenu group={group} tag={tag} tagValue={tagValue} />
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
  const theme = useTheme();
  const userValues = getUserTagValue(tagValue);
  const value =
    tagValue.value === '' ? <Text variant="muted">{t('(empty)')}</Text> : tagValue.value;
  let valueComponent: React.ReactNode = value;
  if (tagValue.value !== '') {
    if (tagKey === 'user') {
      valueComponent = (
        <UserValue>
          {getContextIcon({
            alias: 'user',
            type: 'user',
            value: tagValue,
            contextIconProps: {
              size: 'md',
            },
            theme,
          })}
          <div>{userValues.title}</div>
          {userValues.subtitle && <UserSubtitle>{userValues.subtitle}</UserSubtitle>}
        </UserValue>
      );
    } else if (tagKey === 'device') {
      valueComponent = <DeviceName value={tagValue.value} />;
    }
  }

  return (
    <Flex gap="xs" align="center">
      <ValueLink to={valueLocation}>{valueComponent}</ValueLink>
      {isUrl(tagValue.value) && (
        <ExternalLinkbutton
          priority="link"
          icon={<IconOpen />}
          aria-label="Open link"
          size="xs"
          onClick={() => openNavigateToExternalLinkModal({linkText: tagValue.value})}
        />
      )}
    </Flex>
  );
}

function TagValueActionsMenu({
  group,
  tag,
  tagValue,
}: {
  group: Group;
  tag: Tag;
  tagValue: TagValue;
}) {
  const organization = useOrganization();
  const {copy} = useCopyToClipboard();

  const referrer = 'tag-details-drawer';
  const key = escapeIssueTagKey(tagValue.key ?? tag.key);
  const query = tagValue.query
    ? {
        query: tagValue.query,
      }
    : generateQueryWithTag({referrer}, {key, value: tagValue.value});
  const eventView = useIssueDetailsEventView({group, queryProps: query});
  const [isVisible, setIsVisible] = useState(false);

  return (
    <DropdownMenu
      size="xs"
      className={isVisible ? '' : 'invisible'}
      onOpenChange={isOpen => setIsVisible(isOpen)}
      triggerProps={{
        'aria-label': t('Tag Value Actions Menu'),
        icon: <IconEllipsis />,
        showChevron: false,
        size: 'xs',
      }}
      items={[
        {
          key: 'open-in-discover',
          label: t('Open in Discover'),
          to: eventView.getResultsViewUrlTarget(
            organization,
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
          label: t('Search issues with this tag value'),
          to: {
            pathname: `/organizations/${organization.slug}/issues/`,
            query,
          },
        },
        {
          key: 'copy-value',
          label: t('Copy tag value to clipboard'),
          onAction: () =>
            copy(tagValue.value, {successMessage: t('Copied tag value to clipboard')}),
          hidden: tagValue.value === '',
        },
      ]}
    />
  );
}

const Table = styled('div')`
  display: grid;
  grid-template-columns: 1fr 0.22fr min-content min-content 45px min-content;
  column-gap: ${space(1)};
  row-gap: ${space(0.5)};
  margin: 0 -${space(1)};

  @media (min-width: ${p => p.theme.breakpoints.xl}) {
    column-gap: ${space(2)};
  }
`;

const ColumnTitle = styled('div')`
  white-space: nowrap;
  color: ${p => p.theme.tokens.content.secondary};
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const ShareColumnTitle = styled(ColumnTitle)`
  text-align: center;
`;

const ColumnSort = styled(Link)`
  display: flex;
  gap: ${space(0.5)};
  align-items: center;
  white-space: nowrap;
  color: ${p => p.theme.tokens.content.secondary};
  font-weight: ${p => p.theme.fontWeight.bold};
  text-decoration: underline;
  text-decoration-style: dotted;
  text-decoration-color: ${p => p.theme.tokens.content.primary};
  &:hover {
    color: ${p => p.theme.tokens.content.secondary};
  }
`;

const Body = styled('div')`
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
`;

const Header = styled(Body)`
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  margin: 0 ${space(1)};
`;

const Row = styled(Body)`
  &:nth-child(even) {
    background: ${p => p.theme.tokens.background.secondary};
  }
  align-items: center;
  border-radius: 4px;
  padding: ${space(0.25)} ${space(1)};

  .invisible {
    visibility: hidden;
  }
  &:hover,
  &:active {
    .invisible {
      visibility: visible;
    }
  }
`;

const RightAlignedValue = styled('div')`
  text-align: right;
`;

const UserSubtitle = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
  display: inline-block; /* Prevent inheriting text decoration */
`;

const ValueLink = styled(Link)`
  color: ${p => p.theme.tokens.content.primary};
  word-break: break-all;
`;

const OverflowTimeSince = styled(TimeSince)`
  ${p => p.theme.overflowEllipsis};
`;

const ExternalLinkbutton = styled(Button)`
  color: ${p => p.theme.tokens.content.secondary};
`;

const UserValue = styled('div')`
  display: flex;
  gap: ${space(0.75)};
  font-size: ${p => p.theme.fontSize.md};
`;
