import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import {Location, LocationDescriptor} from 'history';

import {fetchTagFacets, Tag, TagSegment} from 'sentry/actionCreators/events';
import {Client} from 'sentry/api';
import ErrorPanel from 'sentry/components/charts/errorPanel';
import {SectionHeading} from 'sentry/components/charts/styles';
import EmptyStateWarning from 'sentry/components/emptyStateWarning';
import Placeholder from 'sentry/components/placeholder';
import TagDistributionMeter from 'sentry/components/tagDistributionMeter';
import {IconWarning} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import EventView, {isAPIPayloadSimilar} from 'sentry/utils/discover/eventView';
import withApi from 'sentry/utils/withApi';

type Props = {
  api: Client;
  eventView: EventView;
  generateUrl: (key: string, value: string) => LocationDescriptor;
  location: Location;
  organization: Organization;
  totalValues: null | number;
  confirmedQuery?: boolean;
};

type State = {
  error: string;
  loading: boolean;
  tags: Tag[];
  totalValues: null | number;
};

class Tags extends Component<Props, State> {
  state: State = {
    loading: true,
    tags: [],
    totalValues: null,
    error: '',
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

  fetchData = async (forceFetchData = false) => {
    const {api, organization, eventView, location, confirmedQuery} = this.props;
    this.setState({loading: true, error: '', tags: []});

    // Fetch should be forced after mounting as confirmedQuery isn't guaranteed
    // since this component can mount/unmount via show/hide tags separate from
    // data being loaded for the rest of the page.
    if (!forceFetchData && confirmedQuery === false) {
      return;
    }

    try {
      const tags = await fetchTagFacets(
        api,
        organization.slug,
        eventView.getFacetsAPIPayload(location)
      );
      this.setState({loading: false, tags});
    } catch (err) {
      Sentry.captureException(err);
      this.setState({loading: false, error: err});
    }
  };

  handleTagClick = (tag: string) => {
    const {organization} = this.props;
    // metrics
    trackAdvancedAnalyticsEvent('discover_v2.facet_map.clicked', {organization, tag});
  };

  renderTag(tag: Tag) {
    const {generateUrl, totalValues} = this.props;

    const segments: TagSegment[] = tag.topValues.map(segment => {
      segment.url = generateUrl(tag.key, segment.value);

      return segment;
    });
    // Ensure we don't show >100% if there's a slight mismatch between the facets
    // endpoint and the totals endpoint
    const maxTotalValues =
      segments.length > 0
        ? Math.max(Number(totalValues), segments[0].count)
        : totalValues;
    return (
      <TagDistributionMeter
        key={tag.key}
        title={tag.key}
        segments={segments}
        totalValues={Number(maxTotalValues)}
        renderLoading={() => <StyledPlaceholder height="16px" />}
        onTagClick={this.handleTagClick}
        showReleasePackage
      />
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
    const {loading, error, tags} = this.state;
    if (loading) {
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
      return tags.map(tag => this.renderTag(tag));
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

export {Tags};
export default withApi(Tags);
