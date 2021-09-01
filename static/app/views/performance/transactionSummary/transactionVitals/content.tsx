import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import Button from 'app/components/button';
import DropdownControl, {DropdownItem} from 'app/components/dropdownControl';
import SearchBar from 'app/components/events/searchBar';
import * as Layout from 'app/components/layouts/thirds';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import EventView from 'app/utils/discover/eventView';
import Histogram from 'app/utils/performance/histogram';
import {FILTER_OPTIONS} from 'app/utils/performance/histogram/constants';
import {decodeScalar} from 'app/utils/queryString';

import {ZOOM_KEYS} from './constants';
import VitalsPanel from './vitalsPanel';

type Props = {
  location: Location;
  organization: Organization;
  eventView: EventView;
};

function VitalsContent(props: Props) {
  const {location, organization, eventView} = props;
  const query = decodeScalar(location.query.query, '');

  const handleSearch = (newQuery: string) => {
    const queryParams = getParams({
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

  return (
    <Histogram location={location} zoomKeys={ZOOM_KEYS}>
      {({activeFilter, handleFilterChange, handleResetView, isZoomed}) => (
        <Layout.Main fullWidth>
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
          />
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
  grid-gap: ${space(2)};
  grid-template-columns: auto max-content max-content;
  align-items: center;
  margin-bottom: ${space(3)};
`;

export default VitalsContent;
