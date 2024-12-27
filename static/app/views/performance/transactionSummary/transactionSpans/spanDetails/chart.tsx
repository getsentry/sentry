import Feature from 'sentry/components/acl/feature';
import OptionSelector from 'sentry/components/charts/optionSelector';
import {
  ChartContainer,
  ChartControls,
  InlineContainer,
  SectionHeading,
  SectionValue,
} from 'sentry/components/charts/styles';
import Count from 'sentry/components/count';
import Panel from 'sentry/components/panels/panel';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import type EventView from 'sentry/utils/discover/eventView';
import type {SpanSlug} from 'sentry/utils/performance/suspectSpans/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

import ExclusiveTimeHistogram from './exclusiveTimeHistogram';
import ExclusiveTimeTimeSeries from './exclusiveTimeTimeSeries';

type Props = {
  eventView: EventView;
  organization: Organization;
  spanSlug: SpanSlug;
  totalCount?: number;
};

enum DisplayModes {
  TIMESERIES = 'timeseries',
  HISTOGRAM = 'histogram',
}

function Chart(props: Props) {
  const navigate = useNavigate();
  const location = useLocation();

  const display = decodeScalar(location.query.display, DisplayModes.TIMESERIES);

  function generateDisplayOptions() {
    return [
      {value: DisplayModes.TIMESERIES, label: t('Self Time Breakdown')},
      {value: DisplayModes.HISTOGRAM, label: t('Self Time Distribution')},
    ];
  }

  function handleDisplayChange(value: string) {
    trackAnalytics('performance_views.span_summary.change_chart', {
      organization: props.organization,
      change_to_display: value,
    });

    navigate({
      pathname: location.pathname,
      query: {
        ...location.query,
        display: value,
      },
    });
  }

  return (
    <Panel>
      <ChartContainer>
        <Feature features="performance-span-histogram-view">
          {({hasFeature}) => {
            if (hasFeature) {
              if (display === DisplayModes.TIMESERIES) {
                return <ExclusiveTimeTimeSeries {...props} withoutZerofill={false} />;
              }
              return <ExclusiveTimeHistogram {...props} />;
            }
            return <ExclusiveTimeTimeSeries {...props} withoutZerofill={false} />;
          }}
        </Feature>
      </ChartContainer>
      <Feature features="performance-span-histogram-view">
        <ChartControls>
          <InlineContainer>
            <SectionHeading>{t('Total Events')}</SectionHeading>
            <SectionValue data-test-id="total-value">
              {defined(props.totalCount) ? <Count value={props.totalCount} /> : '\u2014'}
            </SectionValue>
          </InlineContainer>
          <InlineContainer data-test-id="display-toggle">
            <OptionSelector
              title={t('Display')}
              selected={display}
              options={generateDisplayOptions()}
              onChange={handleDisplayChange}
            />
          </InlineContainer>
        </ChartControls>
      </Feature>
    </Panel>
  );
}

export default Chart;
