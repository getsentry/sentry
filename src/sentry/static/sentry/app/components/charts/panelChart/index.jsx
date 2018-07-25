import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {Panel, PanelHeader} from 'app/components/panels';

import Legend from './legend';

const PanelChart = styled(
  class PanelChart extends React.Component {
    static propTypes = {
      /**
       * Can be either a react element or a render prop that receives
       * the same props passed to `PanelChart`
       */
      children: PropTypes.oneOf([PropTypes.func, PropTypes.node]),
      showLegend: PropTypes.bool,
      title: PropTypes.node,
      ...Legend.propTypes,
    };

    static defaultProps = {
      showLegend: true,
    };

    render() {
      const {title, children, className, showLegend, ...props} = this.props;

      return (
        <Panel className={className}>
          {(title || showLegend) && (
            <PanelHeader>
              {title && <span>{title}</span>}
              {showLegend && <Legend {...props} />}
            </PanelHeader>
          )}
          {children && (
            <ChartWrapper>
              {typeof children === 'function' ? children({title, ...props}) : children}
            </ChartWrapper>
          )}
        </Panel>
      );
    }
  }
)`
  flex: 1;
  overflow: hidden; /* This is required to have flex containers resize */
`;

export default PanelChart;

const ChartWrapper = styled('div')`
  overflow: hidden; /* This is required to have flex containers resize */
`;
