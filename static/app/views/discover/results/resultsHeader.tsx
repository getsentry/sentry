import {Fragment, useCallback, useEffect, useState} from 'react';
import type {Location} from 'history';

import type {ContainerProps} from '@sentry/scraps/layout';

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
import {getDiscoverDeprecation} from 'sentry/views/discover/utils';
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

function ResultsHeaderBase({
  api,
  errorCode,
  eventView,
  location,
  organization,
  setSavedQuery,
  yAxis,
  isHomepage,
  splitDecision,
}: Props) {
  const [homepageQuery, setHomepageQuery] = useState<SavedQuery | undefined>(undefined);
  const [savedQuery, setSavedQueryState] = useState<SavedQuery | undefined>(undefined);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(() => {
    if (!isHomepage && typeof eventView.id === 'string') {
      setLoading(true);
      fetchSavedQuery(api, organization.slug, eventView.id).then(fetchedSavedQuery => {
        setSavedQueryState(getSavedQueryWithDataset(fetchedSavedQuery));
        setLoading(false);
      });
    }
  }, [api, eventView.id, isHomepage, organization.slug]);

  const fetchHomepageQueryData = useCallback(() => {
    setLoading(true);
    fetchHomepageQuery(api, organization.slug).then(fetchedHomepageQuery => {
      setHomepageQuery(getSavedQueryWithDataset(fetchedHomepageQuery));
      setLoading(false);
    });
  }, [api, organization.slug]);

  useEffect(() => {
    if (!isHomepage && eventView.id) {
      fetchData();
    } else if (eventView.id === undefined) {
      setLoading(false);
    }
  }, [eventView.id, isHomepage, fetchData]);

  useEffect(() => {
    if (isHomepage) {
      fetchHomepageQueryData();
    }
  }, [isHomepage, fetchHomepageQueryData]);

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
      updateCallback={fetchData}
      yAxis={yAxis}
      isHomepage={isHomepage}
      setHomepageQuery={updatedHomepageQuery => {
        setHomepageQuery(getSavedQueryWithDataset(updatedHomepageQuery));
        if (isHomepage) {
          setSavedQuery(updatedHomepageQuery);
        }
      }}
      homepageQuery={homepageQuery}
    />
  );

  const title = (
    <Fragment>
      {getDiscoverDeprecation(organization) ? t('Errors') : t('Discover')}
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

  // there's some styling that gets messed up when choosing to not render the
  // dataset selector tabs so i'm injecting some styles fix it. This should be removed
  // when the dataset selector tabs are removed.
  const deprecationHeaderStyles: ContainerProps<'header'> = {
    padding: {
      'screen:sm': '0',
      'screen:md': '0',
    },
    borderBottom: {
      '2xs': 'none',
      xs: 'none',
      sm: 'none',
      md: 'none',
    },
  };

  return (
    <Layout.Header
      {...(getDiscoverDeprecation(organization) ? deprecationHeaderStyles : {})}
    >
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
      {!getDiscoverDeprecation(organization) && (
        <DatasetSelectorTabs
          eventView={eventView}
          isHomepage={isHomepage}
          savedQuery={savedQuery}
          splitDecision={splitDecision}
        />
      )}
    </Layout.Header>
  );
}

export const ResultsHeader = withApi(ResultsHeaderBase);
