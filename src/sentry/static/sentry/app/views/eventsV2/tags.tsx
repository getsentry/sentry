import React from 'react';
import PropTypes from 'prop-types';
import styled from '@emotion/styled';
import {Location} from 'history';
import {t} from 'app/locale';
import * as Sentry from '@sentry/browser';

import space from 'app/styles/space';
import {Client} from 'app/api';
import SentryTypes from 'app/sentryTypes';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import Placeholder from 'app/components/placeholder';
import TagDistributionMeter from 'app/components/tagDistributionMeter';
import withApi from 'app/utils/withApi';
import {Organization} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {SectionHeading} from './styles';

import {
  fetchTagFacets,
  fetchTotalCount,
  getEventTagSearchUrl,
  Tag,
  TagTopValue,
} from './utils';
import EventView, {isAPIPayloadSimilar} from './eventView';

type Props = {
  api: Client;
  organization: Organization;
  eventView: EventView;
  location: Location;
};

type State = {
  loading: boolean;
  tags: Tag[];
  totalValues: null | number;
};

class Tags extends React.Component<Props, State> {
  static propTypes: any = {
    api: PropTypes.object.isRequired,
    organization: SentryTypes.Organization.isRequired,
    location: PropTypes.object.isRequired,
    eventView: PropTypes.object.isRequired,
  };

  state: State = {
    loading: true,
    tags: [],
    totalValues: null,
  };

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    if (this.shouldRefetchData(prevProps)) {
      this.fetchData();
    }
  }

  shouldRefetchData = (prevProps: Props): boolean => {
    const thisAPIPayload = this.props.eventView.getFacetsAPIPayload(this.props.location);
    const otherAPIPayload = prevProps.eventView.getFacetsAPIPayload(prevProps.location);

    return !isAPIPayloadSimilar(thisAPIPayload, otherAPIPayload);
  };

  fetchData = async () => {
    const {api, organization, eventView, location} = this.props;

    this.setState({loading: true, tags: [], totalValues: null});

    const facetPromise = fetchTagFacets(
      api,
      organization.slug,
      eventView.getFacetsAPIPayload(location)
    );
    const totalValuePromise = fetchTotalCount(
      api,
      organization.slug,
      eventView.getEventsAPIPayload(location)
    );
    Promise.all([facetPromise, totalValuePromise])
      .then(values => {
        this.setState({loading: false, tags: values[0], totalValues: values[1]});
      })
      .catch(err => {
        Sentry.captureException(err);
      });
  };

  onTagClick = (tag: string) => {
    const {organization} = this.props;
    // metrics
    trackAnalyticsEvent({
      eventKey: 'discover_v2.facet_map.clicked',
      eventName: 'Discoverv2: Clicked on a tag on the facet map',
      tag,
      organization_id: parseInt(organization.id, 10),
    });
  };

  renderTag(tag: Tag) {
    const {location} = this.props;
    const {totalValues} = this.state;

    const segments: TagTopValue[] = tag.topValues.map(segment => {
      segment.url = getEventTagSearchUrl(tag.key, segment.value, location);

      return segment;
    });

    return (
      <TagDistributionMeter
        key={tag.key}
        title={tag.key}
        segments={segments}
        totalValues={totalValues}
        renderLoading={() => <StyledPlaceholder height="16px" />}
        onTagClick={this.onTagClick}
      />
    );
  }

  renderPlaceholders() {
    return (
      <React.Fragment>
        <StyledPlaceholderTitle key="title-1" />
        <StyledPlaceholder key="bar-1" />
        <StyledPlaceholderTitle key="title-2" />
        <StyledPlaceholder key="bar-2" />
        <StyledPlaceholderTitle key="title-3" />
        <StyledPlaceholder key="bar-3" />
      </React.Fragment>
    );
  }

  render() {
    return (
      <TagSection>
        <StyledHeading>{t('Event Tag Summary')}</StyledHeading>
        {this.state.loading && this.renderPlaceholders()}
        {this.state.tags.length > 0 && this.state.tags.map(tag => this.renderTag(tag))}
        {!this.state.loading && !this.state.tags.length && (
          <EmptyStateWarning small>{t('No tags')}</EmptyStateWarning>
        )}
      </TagSection>
    );
  }
}

const StyledHeading = styled(SectionHeading)`
  margin: 0 0 ${space(1.5)} 0;
`;

const TagSection = styled('div')`
  margin: ${space(2)} 0;
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
