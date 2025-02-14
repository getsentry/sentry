import {Fragment} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import {CompactSelect} from 'sentry/components/compactSelect';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {TransactionSearchQueryBuilder} from 'sentry/components/performance/transactionSearchQueryBuilder';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import type EventView from 'sentry/utils/discover/eventView';
import type {WebVital} from 'sentry/utils/fields';
import Histogram from 'sentry/utils/performance/histogram';
import {FILTER_OPTIONS} from 'sentry/utils/performance/histogram/constants';
import VitalsCardsDiscoverQuery from 'sentry/utils/performance/vitals/vitalsCardsDiscoverQuery';
import {decodeScalar} from 'sentry/utils/queryString';
import {useNavigate} from 'sentry/utils/useNavigate';

import {VITAL_GROUPS, ZOOM_KEYS} from './constants';
import {isMissingVitalsData} from './utils';
import VitalsPanel from './vitalsPanel';

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
};

function VitalsContent(props: Props) {
  const {location, organization, eventView} = props;
  const navigate = useNavigate();
  const query = decodeScalar(location.query.query, '');

  const handleSearch = (newQuery: string) => {
    const queryParams = normalizeDateTimeParams({
      ...(location.query || {}),
      query: newQuery,
    });

    // do not propagate pagination when making a new search
    delete queryParams.cursor;

    navigate({
      pathname: location.pathname,
      query: queryParams,
    });
  };

  const allVitals = VITAL_GROUPS.reduce((keys: WebVital[], {vitals}) => {
    return keys.concat(vitals);
  }, []);

  return (
    <Histogram location={location} zoomKeys={ZOOM_KEYS}>
      {({activeFilter, handleFilterChange, handleResetView, isZoomed}) => (
        <Layout.Main fullWidth>
          <VitalsCardsDiscoverQuery
            eventView={eventView}
            orgSlug={organization.slug}
            location={location}
            vitals={allVitals}
          >
            {results => {
              const shouldDisplayMissingVitalsAlert =
                !results.isLoading && isMissingVitalsData(results.vitalsData, allVitals);

              return (
                <Fragment>
                  {shouldDisplayMissingVitalsAlert && (
                    <Alert.Container>
                      <Alert type="info" showIcon>
                        {tct(
                          'If this page is looking a little bare, keep in mind not all browsers support these vitals. [link]',
                          {
                            link: (
                              <ExternalLink href="https://docs.sentry.io/product/performance/web-vitals/#browser-support">
                                {t('Read more about browser support.')}
                              </ExternalLink>
                            ),
                          }
                        )}
                      </Alert>
                    </Alert.Container>
                  )}
                  <FilterActions>
                    <PageFilterBar condensed>
                      <EnvironmentPageFilter />
                      <DatePageFilter />
                    </PageFilterBar>
                    <StyledSearchBarWrapper>
                      <TransactionSearchQueryBuilder
                        projects={eventView.project}
                        initialQuery={query}
                        onSearch={handleSearch}
                        searchSource="transaction_events"
                      />
                    </StyledSearchBarWrapper>
                    <CompactSelect
                      value={activeFilter.value}
                      options={FILTER_OPTIONS}
                      onChange={opt => {
                        trackAnalytics('performance_views.vitals.filter_changed', {
                          organization,
                          value: opt.value,
                        });
                        handleFilterChange(opt.value);
                      }}
                      triggerProps={{prefix: t('Outliers')}}
                      triggerLabel={activeFilter.label}
                    />
                    <Button
                      onClick={() => {
                        trackAnalytics('performance_views.vitals.reset_view', {
                          organization,
                        });

                        handleResetView();
                      }}
                      disabled={!isZoomed}
                      data-test-id="reset-view"
                    >
                      {t('Reset View')}
                    </Button>
                  </FilterActions>
                  <VitalsPanel
                    organization={organization}
                    location={location}
                    eventView={eventView}
                    dataFilter={activeFilter.value}
                    results={results}
                  />
                </Fragment>
              );
            }}
          </VitalsCardsDiscoverQuery>
        </Layout.Main>
      )}
    </Histogram>
  );
}

const FilterActions = styled('div')`
  display: grid;
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: repeat(3, min-content);
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    grid-template-columns: auto 1fr auto auto;
  }
`;

const StyledSearchBarWrapper = styled('div')`
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    order: 1;
    grid-column: 1/6;
  }

  @media (min-width: ${p => p.theme.breakpoints.xlarge}) {
    order: initial;
    grid-column: auto;
  }
`;

export default VitalsContent;
