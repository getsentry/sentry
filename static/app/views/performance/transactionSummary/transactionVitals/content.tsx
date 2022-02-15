import React from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import DropdownControl, {DropdownItem} from 'sentry/components/dropdownControl';
import SearchBar from 'sentry/components/events/searchBar';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {IconInfo} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization} from 'sentry/types';
import {trackAnalyticsEvent} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import {WebVital} from 'sentry/utils/discover/fields';
import Histogram from 'sentry/utils/performance/histogram';
import {FILTER_OPTIONS} from 'sentry/utils/performance/histogram/constants';
import VitalsCardsDiscoverQuery from 'sentry/utils/performance/vitals/vitalsCardsDiscoverQuery';
import {decodeScalar} from 'sentry/utils/queryString';

import {VITAL_GROUPS, ZOOM_KEYS} from './constants';
import VitalsPanel from './vitalsPanel';

type Props = {
  eventView: EventView;
  location: Location;
  organization: Organization;
};

function VitalsContent(props: Props) {
  const {location, organization, eventView} = props;
  const query = decodeScalar(location.query.query, '');

  const handleSearch = (newQuery: string) => {
    const queryParams = normalizeDateTimeParams({
      ...(location.query || {}),
      query: newQuery,
    });

    // do not propagate pagination when making a new search
    delete queryParams.cursor;

    browserHistory.push({
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
              const isMissingVitalsData =
                !results.isLoading &&
                allVitals.some(vital => !results.vitalsData?.[vital]);

              return (
                <React.Fragment>
                  {isMissingVitalsData && (
                    <Alert type="info" icon={<IconInfo size="md" />}>
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
                  )}

                  <StyledActions>
                    <StyledSearchBar
                      organization={organization}
                      projectIds={eventView.project}
                      query={query}
                      fields={eventView.fields}
                      onSearch={handleSearch}
                    />
                    <DropdownControl
                      buttonProps={{prefix: t('Outliers')}}
                      label={activeFilter.label}
                    >
                      {FILTER_OPTIONS.map(({label, value}) => (
                        <DropdownItem
                          key={value}
                          onSelect={(filterOption: string) => {
                            trackAnalyticsEvent({
                              eventKey: 'performance_views.vitals.filter_changed',
                              eventName: 'Performance Views: Change vitals filter',
                              organization_id: organization.id,
                              value: filterOption,
                            });
                            handleFilterChange(filterOption);
                          }}
                          eventKey={value}
                          isActive={value === activeFilter.value}
                        >
                          {label}
                        </DropdownItem>
                      ))}
                    </DropdownControl>
                    <Button
                      onClick={() => {
                        trackAnalyticsEvent({
                          eventKey: 'performance_views.vitals.reset_view',
                          eventName: 'Performance Views: Reset vitals view',
                          organization_id: organization.id,
                        });

                        handleResetView();
                      }}
                      disabled={!isZoomed}
                      data-test-id="reset-view"
                    >
                      {t('Reset View')}
                    </Button>
                  </StyledActions>
                  <VitalsPanel
                    organization={organization}
                    location={location}
                    eventView={eventView}
                    dataFilter={activeFilter.value}
                    results={results}
                  />
                </React.Fragment>
              );
            }}
          </VitalsCardsDiscoverQuery>
        </Layout.Main>
      )}
    </Histogram>
  );
}

const StyledSearchBar = styled(SearchBar)`
  flex-grow: 1;
`;

const StyledActions = styled('div')`
  display: grid;
  gap: ${space(2)};
  grid-template-columns: auto max-content max-content;
  align-items: center;
  margin-bottom: ${space(3)};
`;

export default VitalsContent;
