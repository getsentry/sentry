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
import {IconWarning} from 'app/icons';
import theme from 'app/utils/theme';
import Placeholder from 'app/components/placeholder';
import TagDistributionMeter, {TagSegment} from 'app/components/tagDistributionMeter';
import withApi from 'app/utils/withApi';
import {Organization} from 'app/types';
import {generateQueryWithTag} from 'app/utils';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {SectionHeading} from './styles';

import {fetchTagFacets, Tag} from './utils';
import EventView, {isAPIPayloadSimilar} from './eventView';

type Props = {
  api: Client;
  organization: Organization;
  eventView: EventView;
  location: Location;
  totalValues: null | number;
};

type State = {
  loading: boolean;
  tags: Tag[];
  totalValues: null | number;
  error: string;
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
    error: '',
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
    this.setState({loading: true, error: '', tags: []});

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
    const {organization, eventView, totalValues} = this.props;

    const segments: TagSegment[] = tag.topValues.map(segment => {
      const url = eventView.getResultsViewUrlTarget(organization.slug);
      url.query = generateQueryWithTag(url.query, {
        key: tag.key,
        value: segment.value,
      });
      segment.url = url;

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
        onTagClick={this.onTagClick}
        showReleasePackage
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

  renderBody = () => {
    const {loading, error, tags} = this.state;
    if (loading) {
      return this.renderPlaceholders();
    }
    if (error) {
      return <EmptyStateWarning small />;
    }
    if (tags.length > 0) {
      return tags.map(tag => this.renderTag(tag));
    } else {
      return (
        <StyledError>
          <StyledIconWarning color={theme.gray2} size="lg" />
          {t('No tags found')}
        </StyledError>
      );
    }
  };

  render() {
    return (
      <TagSection>
        <StyledHeading>{t('Event Tag Summary')}</StyledHeading>
        {this.renderBody()}
      </TagSection>
    );
  }
}

// These styled components are used in getsentry for a paywall.
export const StyledHeading = styled(SectionHeading)`
  margin: 0 0 ${space(1.5)} 0;
`;

export const TagSection = styled('div')`
  margin: ${space(0.5)} 0;
`;

const StyledError = styled('div')`
  color: ${p => p.theme.gray2};
  display: flex;
  align-items: center;
`;

const StyledIconWarning = styled(IconWarning)`
  margin-right: ${space(1)};
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
