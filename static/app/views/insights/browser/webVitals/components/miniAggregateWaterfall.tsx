import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {LinkButton} from 'sentry/components/button';
import {noFilter} from 'sentry/components/events/interfaces/spans/filter';
import {ActualMinimap} from 'sentry/components/events/interfaces/spans/header';
import {useSpanWaterfallModelFromTransaction} from 'sentry/components/events/interfaces/spans/useSpanWaterfallModelFromTransaction';
import OpsBreakdown from 'sentry/components/events/opsBreakdown';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {LandingDisplayField} from 'sentry/views/insights/browser/webVitals/views/pageOverview';

type Props = {
  transaction: string;
  aggregateSpansLocation?: Location;
};

export function MiniAggregateWaterfall({transaction, aggregateSpansLocation}: Props) {
  const theme = useTheme();
  const location = useLocation();
  const organization = useOrganization();

  // Pageload transactions don't seem to store http.method, so don't include one here
  const {waterfallModel, event, isLoading} =
    useSpanWaterfallModelFromTransaction(transaction);
  if (isLoading) {
    return <LoadingIndicator />;
  }
  const AggregateSpanWaterfallLocation = aggregateSpansLocation ?? {
    ...location,
    query: {
      ...location.query,
      tab: LandingDisplayField.SPANS,
    },
  };
  const minimap = (
    <ActualMinimap
      theme={theme}
      spans={waterfallModel.getWaterfall({
        viewStart: 0,
        viewEnd: 1,
      })}
      generateBounds={waterfallModel.generateBounds({
        viewStart: 0,
        viewEnd: 1,
      })}
      dividerPosition={0}
      rootSpan={waterfallModel.rootSpan.span}
    />
  );
  const opsBreakdown = (
    <OpsBreakdown operationNameFilters={noFilter} event={event} topN={3} hideHeader />
  );
  return (
    <span>
      <MinimapContainer>{minimap}</MinimapContainer>
      <BreakdownContainer>{opsBreakdown}</BreakdownContainer>
      <LinkButton
        aria-label={t('View Full Waterfall')}
        size="sm"
        to={AggregateSpanWaterfallLocation}
        onClick={() => {
          trackAnalytics('insight.vital.overview.open_full_waterfall', {
            organization,
          });
        }}
      >
        {t('View Full Waterfall')}
      </LinkButton>
    </span>
  );
}

const MinimapContainer = styled('div')`
  position: relative;
  height: 120px;
`;

// Not ideal, but OpsBreakdown has margins in nested components. Easiest way to update them for now.
const BreakdownContainer = styled('div')`
  > div {
    margin: 0;
  }
  margin: ${space(2)} 0;
`;
