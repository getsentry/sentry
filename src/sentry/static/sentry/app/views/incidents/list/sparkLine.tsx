import React from 'react';
import styled from 'react-emotion';

import Placeholder from 'app/components/placeholder';
import SentryTypes from 'app/sentryTypes';
import theme from 'app/utils/theme';
import {Incident} from 'app/views/incidents/types';

// Height of sparkline
const SPARKLINE_HEIGHT = 38;

type Props = {
  className?: string;
  incident: Incident;
};

const Sparklines = React.lazy(() =>
  import(/* webpackChunkName: "Sparklines" */ 'app/components/sparklines')
);
const SparklinesLine = React.lazy(() =>
  import(/* webpackChunkName: "SparklinesLine" */ 'app/components/sparklines/line')
);

class SparkLine extends React.Component<Props> {
  static propTypes = {
    incident: SentryTypes.Incident.isRequired,
  };

  render() {
    const {className, incident} = this.props;

    const data = incident.eventStats.data.map(([, value]) =>
      value && Array.isArray(value) && value.length ? value[0].count || 0 : 0
    );

    return (
      <React.Suspense fallback={<SparkLinePlaceholder />}>
        <div data-test-id="incident-sparkline" className={className}>
          <Sparklines data={data} width={100} height={32}>
            <SparklinesLine style={{stroke: theme.gray2, fill: 'none', strokeWidth: 2}} />
          </Sparklines>
        </div>
      </React.Suspense>
    );
  }
}

const StyledSparkLine = styled(SparkLine)`
  flex-shrink: 0;
  width: 120px;
  height: ${SPARKLINE_HEIGHT}px;
`;

const SparkLinePlaceholder = styled(Placeholder)`
  background-color: transparent;
  height: ${SPARKLINE_HEIGHT}px;
`;

export default StyledSparkLine;
