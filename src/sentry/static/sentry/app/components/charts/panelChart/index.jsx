import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {Panel, PanelHeader} from 'app/components/panels';

import Legend from './legend';

const PanelChart = styled(
  class extends React.Component {
    static propTypes = {
      showLegend: PropTypes.bool,
      title: PropTypes.node,
      ...Legend.propTypes,
    };

    static defaultProps = {
      showLegend: true,
    };

    constructor(props) {
      super(props);
    }

    render() {
      // Don't destructure `height` so that we can pass to children
      const {title, children, className, showLegend, ...props} = this.props;

      return (
        <Panel className={className}>
          {(title || showLegend) && (
            <PanelHeader>
              {title && <span>{title}</span>}
              {showLegend && <Legend {...props} />}
            </PanelHeader>
          )}
          {children && <ChartWrapper>{children}</ChartWrapper>}
        </Panel>
      );
    }
  }
)`
  flex: 1;
  overflow: hidden;
`;

export default PanelChart;

const ChartWrapper = styled('div')`
  overflow: hidden;
`;
