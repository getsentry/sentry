import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import type {Location, LocationDescriptor} from 'history';

import type {Tag, TagSegment} from 'sentry/actionCreators/events';
import {fetchTagFacets} from 'sentry/actionCreators/events';
import type {Client} from 'sentry/api';
import {Button} from 'sentry/components/button';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import {SectionHeading} from 'sentry/components/charts/styles';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import {TagFacetsList} from 'sentry/components/group/tagFacets';
import TagFacetsDistributionMeter from 'sentry/components/group/tagFacets/tagFacetsDistributionMeter';
import Placeholder from 'sentry/components/placeholder';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type EventView from 'sentry/utils/discover/eventView';
import {isAPIPayloadSimilar} from 'sentry/utils/discover/eventView';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import withApi from 'sentry/utils/withApi';

type Props = {
  api: Client;
  eventView: EventView;
  generateUrl: (key: string, value: string) => LocationDescriptor;
  location: Location;
  organization: Organization;
  totalValues: null | number;
  confirmedQuery?: boolean;
  onTagValueClick?: (title: string, value: TagSegment) => void;
  tagsQueryResults?: UseApiQueryResult<Tag[], RequestError>;
};

type State = {
  error: string;
  hasLoaded: boolean;
  hasMore: boolean;
  loading: boolean;
  tags: Tag[];
  totalValues: null | number;
  nextCursor?: string;
  tagLinks?: string;
};

class Tags extends Component<Props, State> {
  state: State = {
    loading: true,
    tags: [],
    totalValues: null,
    error: '',
    hasMore: false,
    hasLoaded: false,
  };

  componentDidMount() {
    this.fetchData(true);
  }

  componentDidUpdate(prevProps: Props) {
    if (
      this.shouldRefetchData(prevProps) ||
      prevProps.confirmedQuery !== this.props.confirmedQuery
    ) {
      this.fetchData();
    }
  }

  shouldRefetchData = (prevProps: Props): boolean => {
    const thisAPIPayload = this.props.eventView.getFacetsAPIPayload(this.props.location);
    const otherAPIPayload = prevProps.eventView.getFacetsAPIPayload(prevProps.location);

    return !isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);
  };

  fetchData = async (
    forceFetchData = false,
    nextCursor?: string,
    appendTags?: boolean
  ) => {
    const {api, organization, eventView, location, confirmedQuery} = this.props;

    this.setState({loading: true, error: ''});
    if (!appendTags) {
      this.setState({hasLoaded: false, tags: []});
    }

    // If we have tagsQueryResults, we can use that instead of fetching new data on mount.
    if (!appendTags && this.props.tagsQueryResults) {
      const pageLinks =
        this.props.tagsQueryResults?.getResponseHeader?.('Link') ?? undefined;
      let hasMore = false;
      let cursor: string | undefined;
      if (pageLinks) {
        const paginationObject = parseLinkHeader(pageLinks);
        hasMore = paginationObject?.next?.results ?? false;
        cursor = paginationObject.next?.cursor;
      }

      this.setState({
        tags: this.props.tagsQueryResults.data || [],
        loading: this.props.tagsQueryResults.isPending,
        hasLoaded: !this.props.tagsQueryResults.isPending,
        hasMore,
        nextCursor: cursor,
        error: this.props.tagsQueryResults.error?.message || '',
      });
      return;
    }

    // Fetch should be forced after mounting as confirmedQuery isn't guaranteed
    // since this component can mount/unmount via show/hide tags separate from
    // data being loaded for the rest of the page.
    if (!forceFetchData && confirmedQuery === false) {
      return;
    }

    try {
      const [data, , resp] = await fetchTagFacets(api, organization.slug, {
        ...eventView.getFacetsAPIPayload(location),
        cursor: nextCursor,
      });

      const pageLinks = resp?.getResponseHeader('Link') ?? undefined;
      let hasMore = false;
      let cursor: string | undefined;
      if (pageLinks) {
        const paginationObject = parseLinkHeader(pageLinks);
        hasMore = paginationObject?.next?.results ?? false;
        cursor = paginationObject.next?.cursor;
      }

      let tags = data;
      if (appendTags) {
        tags = [...this.state.tags, ...tags];
      }
      this.setState({loading: false, hasLoaded: true, tags, hasMore, nextCursor: cursor});
    } catch (err) {
      if (
        err.status !== 400 &&
        err.responseJSON?.detail !==
          'Invalid date range. Please try a more recent date range.'
      ) {
        Sentry.captureException(err);
      }
      this.setState({loading: false, error: err});
    }
  };

  renderTag(tag: Tag, index: number) {
    const {generateUrl, onTagValueClick, totalValues} = this.props;

    const segments: TagSegment[] = tag.topValues.map(segment => {
      segment.url = generateUrl(tag.key, segment.value);

      return segment;
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
          onTagValueClick={onTagValueClick}
        />
      </li>
    );
  }

  renderPlaceholders() {
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

  renderBody = () => {
    const {loading, hasLoaded, error, tags, hasMore, nextCursor} = this.state;
    if (loading && !hasLoaded) {
      return this.renderPlaceholders();
    }
    if (error) {
      return (
        <ErrorPanel height="132px">
          <IconWarning color="gray300" size="lg" />
        </ErrorPanel>
      );
    }

    if (tags.length > 0) {
      return (
        <Fragment>
          {/* sentry-discover-tags-chromext depends on a stable id */}
          <StyledTagFacetList id="tag-facet-list">
            {tags.map((tag, index) => this.renderTag(tag, index))}
          </StyledTagFacetList>
          {hasMore &&
            (loading ? (
              this.renderPlaceholders()
            ) : (
              <ButtonWrapper>
                <Button
                  size="xs"
                  priority="primary"
                  disabled={loading}
                  aria-label={t('Show More')}
                  onClick={() => {
                    this.fetchData(true, nextCursor, true);
                  }}
                >
                  {t('Show More')}
                </Button>
              </ButtonWrapper>
            ))}
        </Fragment>
      );
    }

    return <StyledEmptyStateWarning small>{t('No tags found')}</StyledEmptyStateWarning>;
  };

  render() {
    return (
      <Fragment>
        <SectionHeading>{t('Tag Summary')}</SectionHeading>
        {this.renderBody()}
      </Fragment>
    );
  }
}

const StyledEmptyStateWarning = styled(EmptyStateWarning)`
  height: 132px;
  padding: 54px 15%;
`;

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

const StyledTagFacetList = styled(TagFacetsList)`
  margin-bottom: 0;
  width: 100%;
`;

const ButtonWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
`;

export {Tags};
export default withApi(Tags);
