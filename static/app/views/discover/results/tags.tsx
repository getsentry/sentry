import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {IconWarning} from '@sentry/icons/warning';
import * as Sentry from '@sentry/react';
import {skipToken, useInfiniteQuery} from '@tanstack/react-query';
import type {Location, LocationDescriptor} from 'history';
import isEqual from 'lodash/isEqual';
import pick from 'lodash/pick';

import {Button} from '@sentry/scraps/button';
import {Stack} from '@sentry/scraps/layout';

import type {Tag, TagSegment} from 'sentry/actionCreators/events';
import {ErrorPanel} from 'sentry/components/charts/errorPanel';
import {SectionHeading} from 'sentry/components/charts/styles';
import {deviceNameMapper} from 'sentry/components/deviceName';
import {EmptyStateWarning} from 'sentry/components/emptyStateWarning';
import {TagFacetsList} from 'sentry/components/group/tagFacets';
import {TagFacetsDistributionMeter} from 'sentry/components/group/tagFacets/tagFacetsDistributionMeter';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {EventView} from 'sentry/utils/discover/eventView';
import {PERFORMANCE_URL_PARAM} from 'sentry/utils/performance/constants';
import {RequestError} from 'sentry/utils/requestError/requestError';

type Props = {
  eventView: EventView;
  generateUrl: (key: string, value: string) => LocationDescriptor;
  location: Location;
  organization: Organization;
  totalValues: null | number;
  confirmedQuery?: boolean;
};

export function Tags({
  eventView,
  generateUrl,
  location,
  organization,
  totalValues,
  confirmedQuery,
}: Props) {
  const facetsPayload = eventView.getFacetsAPIPayload(location);
  const query = {
    ...pick(facetsPayload, PERFORMANCE_URL_PARAM),
    query: facetsPayload.query,
  };

  // The parent pulses confirmedQuery once a potentially expensive query is
  // allowed to run, so hold new params until that pulse. Params seen at mount
  // count as confirmed because the panel can be opened after the pulse happened.
  const [confirmedParams, setConfirmedParams] = useState(query);
  if (confirmedQuery && !isEqual(confirmedParams, query)) {
    setConfirmedParams(query);
  }
  const isConfirmed = isEqual(confirmedParams, query);

  const {data, error, isPending, hasNextPage, fetchNextPage, isFetchingNextPage} =
    useInfiniteQuery(
      apiOptions.asInfinite<Tag[]>()(
        '/organizations/$organizationIdOrSlug/events-facets/',
        {
          path: isConfirmed ? {organizationIdOrSlug: organization.slug} : skipToken,
          query,
          staleTime: 0,
        }
      )
    );

  useEffect(() => {
    if (
      error &&
      !(error instanceof RequestError && [400, 404, 429].includes(error.status ?? 0))
    ) {
      Sentry.captureException(error);
    }
  }, [error]);

  const tags = data?.pages.flatMap(page => page.json) ?? [];

  return (
    <Fragment>
      <SectionHeading>{t('Tag Summary')}</SectionHeading>
      {isPending ? (
        <Placeholders />
      ) : error ? (
        <ErrorPanel height="132px">
          <IconWarning variant="muted" size="lg" />
        </ErrorPanel>
      ) : tags.length > 0 ? (
        <Fragment>
          {/* sentry-discover-tags-chromext depends on a stable id */}
          <StyledTagFacetList id="tag-facet-list">
            {tags.map((tag, index) => (
              <TagFacet
                key={tag.key}
                tag={tag}
                expandByDefault={index === 0}
                generateUrl={generateUrl}
                totalValues={totalValues}
              />
            ))}
          </StyledTagFacetList>
          {hasNextPage &&
            (isFetchingNextPage ? (
              <Placeholders />
            ) : (
              <Stack align="center">
                <Button
                  size="xs"
                  variant="primary"
                  aria-label={t('Show More')}
                  onClick={() => fetchNextPage()}
                >
                  {t('Show More')}
                </Button>
              </Stack>
            ))}
        </Fragment>
      ) : (
        <StyledEmptyStateWarning small>{t('No tags found')}</StyledEmptyStateWarning>
      )}
    </Fragment>
  );
}

function TagFacet({
  tag,
  expandByDefault,
  generateUrl,
  totalValues,
}: {
  expandByDefault: boolean;
  generateUrl: Props['generateUrl'];
  tag: Tag;
  totalValues: Props['totalValues'];
}) {
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
    segments.length > 0 ? Math.max(Number(totalValues), segments[0]!.count) : totalValues;
  return (
    <li aria-label={tag.key}>
      <TagFacetsDistributionMeter
        title={tag.key}
        segments={segments}
        totalValues={Number(maxTotalValues)}
        expandByDefault={expandByDefault}
      />
    </li>
  );
}

function Placeholders() {
  return (
    <Fragment>
      <StyledPlaceholderTitle />
      <StyledPlaceholder />
      <StyledPlaceholderTitle />
      <StyledPlaceholder />
      <StyledPlaceholderTitle />
      <StyledPlaceholder />
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
