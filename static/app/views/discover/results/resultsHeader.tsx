import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {fetchHomepageQuery} from 'sentry/actionCreators/discoverHomepageQueries';
import {fetchSavedQuery} from 'sentry/actionCreators/discoverSavedQueries';
import type {Client} from 'sentry/api';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization, SavedQuery} from 'sentry/types/organization';
import type EventView from 'sentry/utils/discover/eventView';
import type {SavedQueryDatasets} from 'sentry/utils/discover/types';
import withApi from 'sentry/utils/withApi';
import DiscoverBreadcrumb from 'sentry/views/discover/breadcrumb';
import EventInputName from 'sentry/views/discover/eventInputName';
import SavedQueryButtonGroup from 'sentry/views/discover/savedQuery';
import {DatasetSelectorTabs} from 'sentry/views/discover/savedQuery/datasetSelectorTabs';
import {getSavedQueryWithDataset} from 'sentry/views/discover/savedQuery/utils';

type Props = {
  api: Client;
  errorCode: number;
  eventView: EventView;
  location: Location;
  organization: Organization;
  setSavedQuery: (savedQuery?: SavedQuery) => void;
  yAxis: string[];
  isHomepage?: boolean;
  splitDecision?: SavedQueryDatasets;
};

type State = {
  homepageQuery: SavedQuery | undefined;
  loading: boolean;
  savedQuery: SavedQuery | undefined;
};

class ResultsHeader extends Component<Props, State> {
  state: State = {
    homepageQuery: undefined,
    savedQuery: undefined,
    loading: true,
  };

  componentDidMount() {
    const {eventView, isHomepage} = this.props;
    const {loading} = this.state;
    if (!isHomepage && eventView.id) {
      this.fetchData();
    } else if (eventView.id === undefined && loading) {
      // If this is a new query, there's nothing to load
      this.setState({loading: false});
    }
    if (isHomepage) {
      this.fetchHomepageQueryData();
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (
      prevProps.eventView &&
      this.props.eventView &&
      prevProps.eventView.id !== this.props.eventView.id
    ) {
      this.fetchData();
    }
  }

  fetchData() {
    const {api, eventView, organization, isHomepage} = this.props;
    if (!isHomepage && typeof eventView.id === 'string') {
      this.setState({loading: true});
      fetchSavedQuery(api, organization.slug, eventView.id).then(savedQuery => {
        this.setState({
          savedQuery: getSavedQueryWithDataset(savedQuery) as SavedQuery,
          loading: false,
        });
      });
    }
  }

  fetchHomepageQueryData() {
    const {api, organization} = this.props;
    this.setState({loading: true});
    fetchHomepageQuery(api, organization.slug).then(homepageQuery => {
      this.setState({
        homepageQuery: getSavedQueryWithDataset(homepageQuery) as SavedQuery,
        loading: false,
      });
    });
  }

  renderAuthor() {
    const {eventView, isHomepage} = this.props;
    const {savedQuery} = this.state;
    // No saved query in use.
    if (!eventView.id || isHomepage) {
      return null;
    }
    let createdBy = ' \u2014 ';
    let lastEdit: React.ReactNode = ' \u2014 ';
    if (savedQuery !== undefined) {
      createdBy = savedQuery.createdBy?.email || '\u2014';
      lastEdit = <TimeSince date={savedQuery.dateUpdated} />;
    }
    return (
      <Subtitle>
        {t('Created by:')} {createdBy} | {t('Last edited:')} {lastEdit}
      </Subtitle>
    );
  }

  render() {
    const {
      organization,
      location,
      errorCode,
      eventView,
      yAxis,
      setSavedQuery,
      isHomepage,
      splitDecision,
    } = this.props;
    const {savedQuery, loading, homepageQuery} = this.state;
    const hasDiscoverQueryFeature = organization.features.includes('discover-query');

    return (
      <Layout.Header>
        <Layout.HeaderContent>
          {isHomepage ? (
            <GuideAnchor target="discover_landing_header">
              <Layout.Title>
                {t('Discover')}
                <PageHeadingQuestionTooltip
                  docsUrl="https://docs.sentry.io/product/discover-queries/"
                  title={t(
                    'Create queries to get insights into the health of your system.'
                  )}
                />
              </Layout.Title>
            </GuideAnchor>
          ) : hasDiscoverQueryFeature ? (
            <Fragment>
              <DiscoverBreadcrumb
                eventView={eventView}
                organization={organization}
                location={location}
                isHomepage={isHomepage}
              />
              <EventInputName
                savedQuery={savedQuery}
                organization={organization}
                eventView={eventView}
                isHomepage={isHomepage}
              />
            </Fragment>
          ) : (
            // Only has discover-basic
            <Fragment>
              <Layout.Title>
                {t('Discover')}
                <PageHeadingQuestionTooltip
                  docsUrl="https://docs.sentry.io/product/discover-queries/"
                  title={t(
                    'Create queries to get insights into the health of your system.'
                  )}
                />
              </Layout.Title>
            </Fragment>
          )}
          {this.renderAuthor()}
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          <SavedQueryButtonGroup
            setSavedQuery={setSavedQuery}
            location={location}
            organization={organization}
            eventView={eventView}
            savedQuery={savedQuery}
            queryDataLoading={loading}
            disabled={errorCode >= 400 && errorCode < 500}
            updateCallback={() => this.fetchData()}
            yAxis={yAxis}
            isHomepage={isHomepage}
            setHomepageQuery={updatedHomepageQuery => {
              this.setState({
                homepageQuery: getSavedQueryWithDataset(
                  updatedHomepageQuery
                ) as SavedQuery,
              });
              if (isHomepage) {
                setSavedQuery(updatedHomepageQuery);
              }
            }}
            homepageQuery={homepageQuery}
          />
        </Layout.HeaderActions>
        <DatasetSelectorTabs
          eventView={eventView}
          isHomepage={isHomepage}
          savedQuery={savedQuery}
          splitDecision={splitDecision}
        />
      </Layout.Header>
    );
  }
}

const Subtitle = styled('h4')`
  font-size: ${p => p.theme.fontSize.lg};
  font-weight: ${p => p.theme.fontWeight.normal};
  color: ${p => p.theme.tokens.content.secondary};
  margin: ${space(0.5)} 0 0 0;
`;

export default withApi(ResultsHeader);
