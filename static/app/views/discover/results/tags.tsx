import {Fragment, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';
import {IconWarning} from '@sentry/icons/warning';
import * as Sentry from '@sentry/react';
import type {Location, LocationDescriptor} from 'history';

import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';

import type {Tag, TagSegment} from 'sentry/actionCreators/events';
import {fetchTagFacets} from 'sentry/actionCreators/events';
import type {Client} from 'sentry/api';
import {ErrorPanel} from 'sentry/components/charts/errorPanel';
import {SectionHeading} from 'sentry/components/charts/styles';
import {deviceNameMapper} from 'sentry/components/deviceName';
import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import {TagFacetsList} from 'sentry/components/group/tagFacets';
import {TagFacetsDistributionMeter} from 'sentry/components/group/tagFacets/tagFacetsDistributionMeter';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {EventView} from 'sentry/utils/discover/eventView';
import {isAPIPayloadSimilar} from 'sentry/utils/discover/eventView';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {withApi} from 'sentry/utils/withApi';

type Props = {
  api: Client;
  eventView: EventView;
  generateUrl: (key: string, value: string) => LocationDescriptor;
  location: Location;
  organization: Organization;
  totalValues: null | number;
  confirmedQuery?: boolean;
};

type FacetsPayload = ReturnType<EventView['getFacetsAPIPayload']>;

function Tags({
  api,
  eventView,
  generateUrl,
  location,
  organization,
  totalValues,
  confirmedQuery,
}: Props) {
  const [loading, setLoading] = useState(true);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string>('');
  const [tags, setTags] = useState<Tag[]>([]);
  const [hasMore, setHasMore] = useState(false);
  const [nextCursor, setNextCursor] = useState<string | undefined>(undefined);

  // Tracks the most recent request so that stale responses are ignored.
  const requestIdRef = useRef(0);
  const isMountedRef = useRef(false);
  // Values from the previous effect run, used to mirror componentDidUpdate.
  const prevRef = useRef<{
    confirmedQuery: boolean | undefined;
    payload: FacetsPayload;
  } | null>(null);

  const facetsPayload = eventView.getFacetsAPIPayload(location);

  const fetchData = async (
    forceFetchData = false,
    cursor?: string,
    appendTags?: boolean
  ) => {
    const requestId = ++requestIdRef.current;

    setLoading(true);
    setError('');
    if (!appendTags) {
      setHasLoaded(false);
      setTags([]);
    }

    // Fetch should be forced after mounting as confirmedQuery isn't guaranteed
    // since this component can mount/unmount via show/hide tags separate from
    // data being loaded for the rest of the page.
    if (!forceFetchData && confirmedQuery === false) {
      return;
    }

    const isStale = () => !isMountedRef.current || requestId !== requestIdRef.current;

    try {
      const [data, , resp] = await fetchTagFacets(api, organization.slug, {
        ...eventView.getFacetsAPIPayload(location),
        cursor,
      });

      if (isStale()) {
        return;
      }

      const pageLinks = resp?.getResponseHeader('Link') ?? undefined;
      let more = false;
      let newCursor: string | undefined;
      if (pageLinks) {
        const paginationObject = parseLinkHeader(pageLinks);
        more = paginationObject?.next?.results ?? false;
        newCursor = paginationObject.next?.cursor;
      }

      setTags(prevTags => (appendTags ? [...prevTags, ...data] : data));
      setLoading(false);
      setHasLoaded(true);
      setHasMore(more);
      setNextCursor(newCursor);
    } catch (err: any) {
      if (
        err.status !== 400 &&
        err.responseJSON?.detail !==
          'Invalid date range. Please try a more recent date range.'
      ) {
        Sentry.captureException(err);
      }

      if (isStale()) {
        return;
      }

      setLoading(false);
      setError(err);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Runs after every render: force a fetch on mount, then refetch only when the
  // facets payload or confirmedQuery changes (same as the former lifecycles).
  useEffect(() => {
    const prev = prevRef.current;
    prevRef.current = {payload: facetsPayload, confirmedQuery};

    if (prev === null) {
      fetchData(true);
      return;
    }

    if (
      !isAPIPayloadSimilar(facetsPayload, prev.payload) ||
      prev.confirmedQuery !== confirmedQuery
    ) {
      fetchData();
    }
  });

  const renderTag = (tag: Tag, index: number) => {
    const segments: TagSegment[] = tag.topValues.map(segment => {
      return {
        ...segment,
        name: formatTag(tag.key, segment.value),
        url: generateUrl(tag.key, segment.value),
      };
    });
    // Ensure we don't show >100% if there's a slight mismatch between the facets
    // endpoint and the totals endpoint
    const maxTotalValues =
      segments.length > 0
        ? Math.max(Number(totalValues), segments[0]!.count)
        : totalValues;
    return (
      <li key={tag.key} aria-label={tag.key}>
        <TagFacetsDistributionMeter
          title={tag.key}
          segments={segments}
          totalValues={Number(maxTotalValues)}
          expandByDefault={index === 0}
        />
      </li>
    );
  };

  const renderPlaceholders = () => {
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
  };

  const renderBody = () => {
    if (loading && !hasLoaded) {
      return renderPlaceholders();
    }
    if (error) {
      return (
        <ErrorPanel height="132px">
          <IconWarning variant="muted" size="lg" />
        </ErrorPanel>
      );
    }

    if (tags.length > 0) {
      return (
        <Fragment>
          {/* sentry-discover-tags-chromext depends on a stable id */}
          <StyledTagFacetList id="tag-facet-list">
            {tags.map((tag, index) => renderTag(tag, index))}
          </StyledTagFacetList>
          {hasMore &&
            (loading ? (
              renderPlaceholders()
            ) : (
              <Stack align="center">
                <Button
                  size="xs"
                  variant="primary"
                  disabled={loading}
                  aria-label={t('Show More')}
                  onClick={() => {
                    fetchData(true, nextCursor, true);
                  }}
                >
                  {t('Show More')}
                </Button>
              </Stack>
            ))}
        </Fragment>
      );
    }

    return <StyledEmptyStateWarning small>{t('No tags found')}</StyledEmptyStateWarning>;
  };

  return (
    <Fragment>
      <SectionHeading>{t('Tag Summary')}</SectionHeading>
      {renderBody()}
    </Fragment>
  );
}

function formatTag(key: string, value: string): string {
  if (key === 'device') {
    return deviceNameMapper(value) || value;
  }
  return value;
}

const StyledEmptyStateWarning = styled(EmptyStateWarning)`
  height: 132px;
  padding: 54px 15%;
`;

const StyledPlaceholder = styled(Placeholder)`
  border-radius: ${p => p.theme.radius.md};
  height: 16px;
  margin-bottom: ${p => p.theme.space.lg};
`;

const StyledPlaceholderTitle = styled(Placeholder)`
  width: 100px;
  height: 12px;
  margin-bottom: ${p => p.theme.space.xs};
`;

const StyledTagFacetList = styled(TagFacetsList)`
  margin-bottom: 0;
  width: 100%;
`;

export {Tags};
export default withApi(Tags);
