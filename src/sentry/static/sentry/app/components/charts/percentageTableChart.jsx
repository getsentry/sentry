import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import {t} from 'app/locale';
import Count from 'app/components/count';
import InlineSvg from 'app/components/inlineSvg';
import TableChart from 'app/components/charts/tableChart';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

const Delta = ({current, previous, className}) => {
  if (typeof previous === 'undefined') {
    return null;
  }
  const changePercent = Math.round(Math.abs(current - previous) / previous * 100);
  const direction = !changePercent ? 0 : current - previous;
  return (
    <StyledDelta direction={direction} className={className}>
      {!!direction && <DeltaCaret direction={direction} src="icon-chevron-down" />}
      {changePercent !== 0 ? `${changePercent}%` : <span>&mdash;</span>}
    </StyledDelta>
  );
};
Delta.propTypes = {
  current: PropTypes.number,
  previous: PropTypes.number,
};

const DeltaCaret = styled(InlineSvg)`
  /* should probably have a chevron-up svg (: */
  ${p => p.direction > 0 && 'transform: rotate(180deg)'};
  width: 10px;
  height: 10px;
`;

const StyledDelta = styled('div')`
  display: flex;
  align-items: center;
  padding: 0 ${space(0.25)};
  margin-right: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p =>
    p.direction > 0 ? p.theme.green : p.direction < 0 ? p.theme.red : p.theme.gray2};
`;

class PercentageTableChart extends React.Component {
  static propTypes = {
    // Height of body
    height: PropTypes.string,

    // props to pass to PanelHeader
    headerProps: PropTypes.object,

    // Main title (left most column) should
    title: PropTypes.node,

    // Label for the "count" title
    countTitle: PropTypes.node,

    extraTitle: PropTypes.node,
    onRowClick: PropTypes.func,
    data: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.node,
        percentage: PropTypes.number,
        value: PropTypes.number,
        lastValue: PropTypes.number,
      })
    ),
  };

  static defaultProps = {
    title: '',
    countTitle: t('Count'),
    extraTitle: null,
    onRowClick: () => {},
  };

  handleRowClick = (obj, e) => {
    const {onRowClick} = this.props;
    onRowClick(obj, e);
  };

  render() {
    const {height, headerProps, title, countTitle, extraTitle, data} = this.props;

    return (
      <TableChart
        headerProps={headerProps}
        bodyHeight={height}
        headers={[title, countTitle, t('Percentage'), extraTitle]}
        data={data.map(({value, lastValue, name, percentage}) => [
          <Name key="name">{name}</Name>,
          <CountColumn key="count">
            <Delta current={value} previous={lastValue} />
            <Count value={value} />
          </CountColumn>,
          <React.Fragment key="bar">
            <BarWrapper>
              <Bar width={percentage} />
            </BarWrapper>
            <Percentage>{percentage}%</Percentage>
          </React.Fragment>,
        ])}
        renderRow={({items, rowIndex, ...other}) => (
          <Row onClick={this.handleRowClick} data={data} rowIndex={rowIndex}>
            <NameAndCountContainer>
              {items[0]}
              <div>{items[1]}</div>
            </NameAndCountContainer>
            <PercentageContainer>
              <PercentageLabel>{items[2]}</PercentageLabel>
              {items[3]}
            </PercentageContainer>
          </Row>
        )}
      />
    );
  }
}

const Row = styled(function RowComponent({className, data, rowIndex, onClick, children}) {
  return (
    <div
      className={className}
      onClick={e => typeof onClick === 'function' && onClick(data[rowIndex], e)}
    >
      {children}
    </div>
  );
})`
  display: flex;
  flex: 1;
  cursor: pointer;
`;

const StyledPercentageTableChart = styled(PercentageTableChart)`
  width: 100%;
`;

const FlexContainers = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;

const NameAndCountContainer = styled(FlexContainers)`
  flex-shrink: 0;
  margin-right: ${space(2)};
  width: 50%;
`;

const PercentageContainer = styled(FlexContainers)`
  width: 50%;
`;

const PercentageLabel = styled('div')`
  display: flex;
  flex: 1;
  align-items: center;
`;

const BarWrapper = styled('div')`
  flex: 1;
  margin-right: ${space(1)};
  background-color: ${p => p.theme.whiteDark};
`;

const Percentage = styled('div')`
  flex-shrink: 0;
  text-align: right;
  width: 60px;
`;

const Bar = styled(({width, ...props}) => <div {...props} />)`
  flex: 1;
  width: ${p => p.width}%;
  background-color: ${p => p.theme.gray1};
  height: 12px;
  border-radius: 2px;
`;

const Name = styled('span')`
  ${overflowEllipsis};
`;

const CountColumn = styled(Name)`
  display: flex;
  align-items: center;
  margin-left: ${space(0.5)};
`;

export default StyledPercentageTableChart;
