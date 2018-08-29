import {Flex} from 'grid-emotion';
import PropTypes from 'prop-types';
import React from 'react';
import styled from 'react-emotion';

import Count from 'app/components/count';
import InlineSvg from 'app/components/inlineSvg';
import TableChart from 'app/components/charts/tableChart';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';

const Delta = ({current, previous, className}) => {
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

const StyledDelta = styled(Flex)`
  align-items: center;
  padding: 0 ${space(0.25)};
  margin-right: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p =>
    p.direction > 0 ? p.theme.green : p.direction < 0 ? p.theme.red : p.theme.gray2};
`;

class EventsTableChart extends React.Component {
  static propTypes = {
    headers: PropTypes.arrayOf(PropTypes.node),
    data: PropTypes.arrayOf(
      PropTypes.shape({
        name: PropTypes.node,
        percentage: PropTypes.number,
        count: PropTypes.number,
        lastCount: PropTypes.number,
      })
    ),
  };

  render() {
    const {headers, data} = this.props;

    return (
      <TableChart
        headers={headers}
        data={data.map(({count, lastCount, name, percentage}) => [
          <Name key="name">{name}</Name>,
          <Events key="events">
            <Delta current={count} previous={lastCount} />
            <Count value={count} />
          </Events>,
          <React.Fragment key="bar">
            <BarWrapper>
              <Bar width={percentage} />
            </BarWrapper>
            <span>{percentage}%</span>
          </React.Fragment>,
          <LastEvent key="time-ago">n/a</LastEvent>,
        ])}
        renderRow={({items}) => (
          <React.Fragment>
            <NameAndEventsContainer justify="space-between" align="center">
              {items[0]}
              <div>{items[1]}</div>
            </NameAndEventsContainer>
            <PercentageContainer justify="space-between" align="center">
              <Flex w={[3 / 4]} align="center" key="bar">
                {items[2]}
              </Flex>
              <Flex w={[1 / 4]} justify="flex-end" key="last-event">
                {items[3]}
              </Flex>
            </PercentageContainer>
          </React.Fragment>
        )}
      />
    );
  }
}

const StyledEventsTableChart = styled(EventsTableChart)`
  width: 100%;
`;

const NameAndEventsContainer = styled(Flex)`
  flex-shrink: 0;
  margin-right: ${space(2)};
  width: 50%;
`;

const PercentageContainer = styled(Flex)`
  width: 50%;
`;

const BarWrapper = styled('div')`
  width: 85%;
  margin-right: ${space(1)};
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

const Events = styled(Name)`
  display: flex;
  align-items: center;
  margin-left: ${space(0.5)};
`;

const LastEvent = styled(Name)`
  text-align: right;
  margin-left: ${space(0.5)};
`;

export default StyledEventsTableChart;
