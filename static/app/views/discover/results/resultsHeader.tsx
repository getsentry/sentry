import {Component, Fragment} from 'react';
import type {Location} from 'history';

import {fetchHomepageQuery} from 'sentry/actionCreators/discoverHomepageQueries';
import {fetchSavedQuery} from 'sentry/actionCreators/discoverSavedQueries';
import type {Client} from 'sentry/api';
import {GuideAnchor} from 'sentry/components/assistant/guideAnchor';
import * as Layout from 'sentry/components/layouts/thirds';
import {PageHeadingQuestionTooltip} from 'sentry/components/pageHeadingQuestionTooltip';
import {t} from 'sentry/locale';
import type {Organization, SavedQuery} from 'sentry/types/organization';
import type {EventView} from 'sentry/utils/discover/eventView';
import type {SavedQueryDatasets} from 'sentry/utils/discover/types';
import {withApi} from 'sentry/utils/withApi';
import {DiscoverBreadcrumb} from 'sentry/views/discover/breadcrumb';
import SavedQueryButtonGroup from 'sentry/views/discover/savedQuery';
import {DatasetSelectorTabs} from 'sentry/views/discover/savedQuery/datasetSelectorTabs';
import {getSavedQueryWithDataset} from 'sentry/views/discover/savedQuery/utils';
import {TopBar} from 'sentry/views/navigation/topBar';

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

class ResultsHeaderBase extends Component<Props, State> {
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
          savedQuery: getSavedQueryWithDataset(savedQuery)!,
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
        homepageQuery: getSavedQueryWithDataset(homepageQuery)!,
        loading: false,
      });
    });
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

    const savedQueryButton = (
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
            homepageQuery: getSavedQueryWithDataset(updatedHomepageQuery)!,
          });
          if (isHomepage) {
            setSavedQuery(updatedHomepageQuery);
          }
        }}
        homepageQuery={homepageQuery}
      />
    );

    const title = (
      <Fragment>
        {t('Discover')}
        <PageHeadingQuestionTooltip
          docsUrl="https://docs.sentry.io/product/discover-queries/"
          title={t('Create queries to get insights into the health of your system.')}
        />
      </Fragment>
    );

    const pageFrameBreadcrumb = (
      <DiscoverBreadcrumb
        eventView={eventView}
        organization={organization}
        location={location}
        isHomepage={isHomepage}
        savedQuery={savedQuery}
      />
    );

    return (
      <Layout.Header>
        <TopBar.Slot name="title">
          {isHomepage ? (
            <GuideAnchor target="discover_landing_header">{title}</GuideAnchor>
          ) : hasDiscoverQueryFeature ? (
            pageFrameBreadcrumb
          ) : (
            title
          )}
        </TopBar.Slot>
        <TopBar.Slot name="actions">{savedQueryButton}</TopBar.Slot>
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

export const ResultsHeader = withApi(ResultsHeaderBase);
