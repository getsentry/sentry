import {browserHistory, withRouter, WithRouterProps} from 'react-router';
import {Location} from 'history';

import OptionSelector from 'sentry/components/charts/optionSelector';
import {
  ChartContainer,
  ChartControls,
  InlineContainer,
  SectionHeading,
  SectionValue,
} from 'sentry/components/charts/styles';
import {Panel} from 'sentry/components/panels';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
// import {removeHistogramQueryStrings} from 'sentry/utils/performance/histogram';
import {SpanSlug} from 'sentry/utils/performance/suspectSpans/types';
import {decodeScalar} from 'sentry/utils/queryString';

import ExclusiveTimeChart from './exclusiveTimeChart';

type Props = WithRouterProps & {
  eventView: EventView;
  location: Location;
  organization: Organization;
  spanSlug: SpanSlug;
};

enum DisplayModes {
  TIMESERIES = 'timeseries',
  HISTOGRAM = 'histogram',
}

function Chart(props: Props) {
  const {location} = props;

  const display = decodeScalar(props.location.query.display, DisplayModes.TIMESERIES);

  function generateDisplayOptions() {
    return [
      {value: DisplayModes.TIMESERIES, label: t('Self Time Breakdown')},
      {value: DisplayModes.HISTOGRAM, label: t('Self Time Distribution')},
    ];
  }

  function handleDisplayChange(value: string) {
    browserHistory.push({
      pathname: location.pathname,
      query: {
        ...location.query,
        // ...removeHistogramQueryStrings(location, [Z])
        display: value,
      },
    });
  }

  return (
    <Panel>
      <ChartContainer>
        <ExclusiveTimeChart {...props} withoutZerofill={false} display={display} />
      </ChartContainer>
      <ChartControls>
        <InlineContainer>
          <SectionHeading key="total-heading">{t('Total Events')}</SectionHeading>
          <SectionValue key="total-value">{100}</SectionValue>
        </InlineContainer>
        <InlineContainer>
          <OptionSelector
            title={t('Display')}
            selected={display}
            options={generateDisplayOptions()}
            onChange={handleDisplayChange}
          />
        </InlineContainer>
      </ChartControls>
    </Panel>
  );
}

export default withRouter(Chart);
