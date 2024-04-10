import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Button} from 'sentry/components/button';
import {DatePageFilter} from 'sentry/components/organizations/datePageFilter';
import {EnvironmentPageFilter} from 'sentry/components/organizations/environmentPageFilter';
import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types';
import type EventView from 'sentry/utils/discover/eventView';
import {removeHistogramQueryStrings} from 'sentry/utils/performance/histogram';

import {ZoomKeys} from '../spanDetails/utils';
import {SPAN_RELATIVE_PERIODS, SPAN_RETENTION_DAYS} from '../utils';

interface SpanDetailsControlsProps {
  eventView: EventView;
  location: Location;
  organization: Organization;
}

export default function SpanDetailsControls({location}: SpanDetailsControlsProps) {
  const handleResetView = () => {
    browserHistory.push({
      pathname: location.pathname,
      query: removeHistogramQueryStrings(location, Object.values(ZoomKeys)),
    });
  };

  const isZoomed = () => Object.values(ZoomKeys).some(key => location.query[key]);

  return (
    <FilterActions>
      <PageFilterBar condensed>
        <EnvironmentPageFilter />
        <DatePageFilter
          relativeOptions={SPAN_RELATIVE_PERIODS}
          maxPickableDays={SPAN_RETENTION_DAYS}
        />
      </PageFilterBar>
      <Button onClick={handleResetView} disabled={!isZoomed()}>
        {t('Reset View')}
      </Button>
    </FilterActions>
  );
}

const FilterActions = styled('div')`
  display: flex;
  justify-content: space-between;
  margin-bottom: ${space(2)};
  flex-direction: column;

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    flex-direction: row;
  }
`;
