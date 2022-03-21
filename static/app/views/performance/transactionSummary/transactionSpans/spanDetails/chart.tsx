import {withRouter, WithRouterProps} from 'react-router';
import {Location} from 'history';

import {ChartContainer} from 'sentry/components/charts/styles';
import {Panel} from 'sentry/components/panels';
import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {SpanSlug} from 'sentry/utils/performance/suspectSpans/types';

import ExclusiveTimeChart from './exclusiveTimeChart';

type Props = WithRouterProps & {
  eventView: EventView;
  location: Location;
  organization: Organization;
  spanSlug: SpanSlug;
};

function Chart(props: Props) {
  return (
    <Panel>
      <ChartContainer>
        <ExclusiveTimeChart {...props} withoutZerofill={false} />
      </ChartContainer>
    </Panel>
  );
}

export default withRouter(Chart);
