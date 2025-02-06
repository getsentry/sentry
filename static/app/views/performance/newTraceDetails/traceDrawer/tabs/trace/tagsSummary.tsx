import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';
import isEmpty from 'lodash/isEmpty';

import type {Tag, TagSegment} from 'sentry/actionCreators/events';
import type {ApiResult} from 'sentry/api';
import {TagFacetsList} from 'sentry/components/group/tagFacets';
import TagFacetsDistributionMeter from 'sentry/components/group/tagFacets/tagFacetsDistributionMeter';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {generateQueryWithTag} from 'sentry/utils';
import type EventView from 'sentry/utils/discover/eventView';
import {formatTagKey} from 'sentry/utils/discover/fields';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import type {InfiniteData, UseInfiniteQueryResult} from 'sentry/utils/queryClient';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import StyledEmptyStateWarning from 'sentry/views/replays/detail/emptyState';

import {TraceDrawerComponents} from '../../details/styles';

const getTagTarget = (
  tagKey: string,
  tagValue: string,
  eventView: EventView,
  organization: Organization
) => {
  const url = eventView.getResultsViewUrlTarget(
    organization.slug,
    false,
    hasDatasetSelector(organization) ? SavedQueryDatasets.ERRORS : undefined
  );
  url.query = generateQueryWithTag(url.query, {
    key: formatTagKey(tagKey),
    value: tagValue,
  });
  return url;
};

type TagSummaryProps = {
  eventView: EventView;
  location: Location;
  organization: Organization;
  tagsInfiniteQueryResults: UseInfiniteQueryResult<
    InfiniteData<ApiResult<Tag[]>, unknown>,
    Error
  >;
  totalValues: number | null;
};

function TagsSummaryPlaceholder() {
  return (
    <Fragment>
      <StyledPlaceholderTitle key="title-1" />
      <StyledPlaceholder key="bar-1" />
      <StyledPlaceholderTitle key="title-2" />
      <StyledPlaceholder key="bar-2" />
      <StyledPlaceholderTitle key="title-3" />
      <StyledPlaceholder key="bar-3" />
    </Fragment>
  );
}

const StyledPlaceholder = styled(Placeholder)`
  border-radius: ${p => p.theme.borderRadius};
  height: 16px;
  margin-bottom: ${space(1.5)};
`;

const StyledPlaceholderTitle = styled(Placeholder)`
  width: 100px;
  height: 12px;
  margin-bottom: ${space(0.5)};
`;

type TagProps = {
  eventView: EventView;
  index: number;
  organization: Organization;
  tag: Tag;
  totalValues: number | null;
};

function TagRow(props: TagProps) {
  const segments: TagSegment[] = props.tag.topValues.map(segment => {
    segment.url = getTagTarget(
      props.tag.key,
      segment.value,
      props.eventView,
      props.organization
    );

    return segment;
  });

  // Ensure we don't show >100% if there's a slight mismatch between the facets
  // endpoint and the totals endpoint
  const maxTotalValues =
    segments.length > 0
      ? Math.max(Number(props.totalValues), segments[0]!.count)
      : props.totalValues;
  return (
    <li key={props.tag.key} aria-label={props.tag.key}>
      <TagFacetsDistributionMeter
        title={props.tag.key}
        segments={segments}
        totalValues={Number(maxTotalValues)}
        expandByDefault={props.index === 0}
      />
    </li>
  );
}

export function TagsSummary(props: TagSummaryProps) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isPending, // If anything is loaded yet
  } = props.tagsInfiniteQueryResults;

  const tags: Tag[] = useMemo(() => {
    if (!data) {
      return [];
    }
    // filter out replayId since we no longer want to
    // display this trace details
    return data.pages
      .flatMap(([pageData]) => (isEmpty(pageData) ? [] : pageData))
      .filter(d => d.key !== 'replayId');
  }, [data]);

  return (
    <TraceDrawerComponents.SectionCard
      items={[
        {
          key: 'tags',
          subject: t('Tags'),
          subjectNode: null,
          value: (
            <Fragment>
              {tags.length > 0 ? (
                <StyledTagFacetList id="tag-facet-list">
                  {tags.map((tag, index) => (
                    <TagRow
                      key={tag.key}
                      tag={tag}
                      index={index}
                      eventView={props.eventView}
                      organization={props.organization}
                      totalValues={props.totalValues}
                    />
                  ))}
                </StyledTagFacetList>
              ) : null}
              {isPending || isFetchingNextPage ? (
                <TagsSummaryPlaceholder />
              ) : tags.length === 0 ? (
                <StyledEmptyStateWarning small>
                  {t('No tags found')}
                </StyledEmptyStateWarning>
              ) : null}
              {hasNextPage ? (
                <ShowMoreWrapper>
                  <a onClick={() => fetchNextPage()}>{t('Show more')}</a>
                </ShowMoreWrapper>
              ) : null}
            </Fragment>
          ),
        },
      ]}
      title={t('Tags')}
    />
  );
}

const StyledTagFacetList = styled(TagFacetsList)`
  margin-bottom: 0;
  width: 100%;
`;

const ShowMoreWrapper = styled('div')`
  display: flex;
  justify-content: center;
`;
