import React from 'react';
import styled from '@emotion/styled';

import {IncidentStats} from 'app/views/alerts/types';
import Placeholder from 'app/components/placeholder';
import theme from 'app/utils/theme';

// Height of sparkline
const SPARKLINE_HEIGHT = 38;

type Props = {
  className?: string;
  eventStats: IncidentStats['eventStats'];
  error?: React.ReactNode;
};

const Sparklines = React.lazy(
  () => import(/* webpackChunkName: "Sparklines" */ 'app/components/sparklines')
);
const SparklinesLine = React.lazy(
  () => import(/* webpackChunkName: "SparklinesLine" */ 'app/components/sparklines/line')
);

class SparkLine extends React.Component<Props> {
  render() {
    const {className, error, eventStats} = this.props;

    if (error) {
      return <SparklineError error={error} />;
    }

    if (!eventStats) {
      return <SparkLinePlaceholder />;
    }

    const data = eventStats.data.map(([, value]) =>
      value && Array.isArray(value) && value.length ? value[0].count || 0 : 0
    );

    return (
      <React.Suspense fallback={<SparkLinePlaceholder />}>
        <div data-test-id="incident-sparkline" className={className}>
          <Sparklines data={data} width={100} height={32}>
            <SparklinesLine
              style={{stroke: theme.gray300, fill: 'none', strokeWidth: 2}}
            />
          </Sparklines>
        </div>
      </React.Suspense>
    );
  }
}

const StyledSparkLine = styled(SparkLine)`
  flex-shrink: 0;
  width: 100%;
  height: ${SPARKLINE_HEIGHT}px;
`;

const SparkLinePlaceholder = styled(Placeholder)`
  height: ${SPARKLINE_HEIGHT}px;
`;

const SparklineError = styled(SparkLinePlaceholder)`
  align-items: center;
  line-height: 1;
`;

export default StyledSparkLine;
