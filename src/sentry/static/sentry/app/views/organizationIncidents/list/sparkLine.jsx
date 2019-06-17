import React from 'react';
import styled from 'react-emotion';

import Placeholder from 'app/components/placeholder';
import SentryTypes from 'app/sentryTypes';
import theme from 'app/utils/theme';

// Height of sparkline
const SPARKLINE_HEIGHT = 38;

class SparkLine extends React.Component {
  static propTypes = {
    incident: SentryTypes.Incident.isRequired,
  };

  state = {
    loading: true,
    error: null,
  };

  componentDidMount() {
    this.loadLibrary();
  }

  async loadLibrary() {
    this.setState({loading: true});

    try {
      const reactSparkLines = await import(/* webpackChunkName: "ReactSparkLines" */ 'react-sparklines');

      this.setState({
        loading: false,
        Sparklines: reactSparkLines.Sparklines,
        SparklinesLine: reactSparkLines.SparklinesLine,
        error: false,
      });
    } catch (error) {
      this.setState({loading: false, error});
    }
  }

  render() {
    const {className, incident} = this.props;
    const {Sparklines, SparklinesLine, loading} = this.state;

    if (loading) {
      return <SparkLinePlaceholder />;
    }

    const data = incident.eventStats.data.map(([, value]) =>
      value && value.length ? value[0].count || 0 : 0
    );

    return (
      <div className={className}>
        <Sparklines data={data} width={100} height={32}>
          <SparklinesLine style={{stroke: theme.gray2, fill: 'none', strokeWidth: 2}} />
        </Sparklines>
      </div>
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
