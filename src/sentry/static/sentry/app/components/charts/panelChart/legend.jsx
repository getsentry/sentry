import {Flex} from 'grid-emotion';
import React from 'react';
import styled from 'react-emotion';

import CircleIndicator from 'app/components/circleIndicator';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import theme from 'app/utils/theme';

const Legend = styled(
  class Legend extends React.Component {
    static propTypes = {
      series: SentryTypes.Series,

      /**
       * Previous Period
       */
      previousPeriod: SentryTypes.SeriesUnit,
    };

    render() {
      let {className, series, previousPeriod} = this.props;

      return (
        <Flex className={className}>
          {previousPeriod && (
            <SeriesGroup>
              <DottedLineIndicator />
              <SeriesName>{previousPeriod.seriesName}</SeriesName>
            </SeriesGroup>
          )}

          {series &&
            series.map((seriesUnit, i) => {
              return (
                <SeriesGroup key={seriesUnit.seriesName}>
                  <CircleIndicator color={theme.charts.colors[i]} />
                  <SeriesName>{seriesUnit.seriesName}</SeriesName>
                </SeriesGroup>
              );
            })}
        </Flex>
      );
    }
  }
)`
  flex: 1;
  justify-content: flex-end;
  align-items: center;
`;

const SeriesGroup = styled(Flex)`
  margin-left: ${space(1)};
  align-items: center;
`;

const SeriesName = styled('span')`
  margin-left: ${space(0.5)};
  text-transform: none;
  font-weight: 400;
`;

const DottedLineIndicator = styled('span')`
  display: flex;
  width: 20px;
  border: 1px dashed ${p => p.theme.charts.previousPeriod};
  align-items: center;
`;

export default Legend;
