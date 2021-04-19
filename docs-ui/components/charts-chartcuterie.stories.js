import React from 'react';
import styled from '@emotion/styled';
import echarts from 'echarts/lib/echarts';
import ReactEchartsCore from 'echarts-for-react/lib/core';

import config from 'app/chartcuterie/config';
import {ChartType} from 'app/chartcuterie/types';
import {getDimensionValue} from 'app/components/charts/utils';
import space from 'app/styles/space';

const {renderConfig} = config;

export default {
  title: 'DataVisualization/Charts/Chartcuterie',
};

export const _SlackDiscoverTotalPeriod = () => {
  const data = [
    [1613577600000, [{count: 3659}]],
    [1613579400000, [{count: 3574}]],
    [1613581200000, [{count: 3360}]],
    [1613583000000, [{count: 2987}]],
    [1613584800000, [{count: 2853}]],
    [1613586600000, [{count: 2759}]],
    [1613588400000, [{count: 2617}]],
    [1613590200000, [{count: 2494}]],
    [1613592000000, [{count: 2341}]],
    [1613593800000, [{count: 2335}]],
    [1613595600000, [{count: 2272}]],
    [1613597400000, [{count: 2176}]],
    [1613599200000, [{count: 2109}]],
    [1613601000000, [{count: 1876}]],
    [1613602800000, [{count: 1626}]],
    [1613604600000, [{count: 1439}]],
    [1613606400000, [{count: 1402}]],
    [1613608200000, [{count: 1355}]],
    [1613610000000, [{count: 1413}]],
    [1613611800000, [{count: 1351}]],
    [1613613600000, [{count: 1347}]],
    [1613615400000, [{count: 1343}]],
    [1613617200000, [{count: 1188}]],
    [1613619000000, [{count: 1162}]],
    [1613620800000, [{count: 1131}]],
  ];

  const {height, width, getOption} = renderConfig.get(
    ChartType.SLACK_DISCOVER_TOTAL_PERIOD
  );

  return (
    <Container>
      <ReactEchartsCore
        echarts={echarts}
        style={{
          height: getDimensionValue(height),
          width: getDimensionValue(width),
        }}
        opts={{height, width, renderer: 'canvas'}}
        option={getOption({seriesName: 'count()', stats: {data}})}
      />
    </Container>
  );
};

export const _SlackDiscoverTotalDaily = () => {
  const data = [
    [1615852800, [{count: 2426486}]],
    [1615939200, [{count: 18837228}]],
    [1616025600, [{count: 14662530}]],
    [1616112000, [{count: 15102981}]],
    [1616198400, [{count: 7759228}]],
    [1616284800, [{count: 7216556}]],
    [1616371200, [{count: 16976035}]],
    [1616457600, [{count: 17240832}]],
    [1616544000, [{count: 16814701}]],
    [1616630400, [{count: 17480989}]],
    [1616716800, [{count: 15387478}]],
    [1616803200, [{count: 8467454}]],
    [1616889600, [{count: 6382678}]],
    [1616976000, [{count: 16842851}]],
    [1617062400, [{count: 12959057}]],
  ];

  const {height, width, getOption} = renderConfig.get(
    ChartType.SLACK_DISCOVER_TOTAL_DAILY
  );

  return (
    <Container>
      <ReactEchartsCore
        echarts={echarts}
        style={{
          height: getDimensionValue(height),
          width: getDimensionValue(width),
        }}
        opts={{height, width, renderer: 'canvas'}}
        option={getOption({seriesName: 'count()', stats: {data}})}
      />
    </Container>
  );
};

export const _SlackDiscoverTop5 = () => {
  const stats = {
    'ludic-science,1st event': {
      data: [
        [1615877940, [{count: 0}]],
        [1615878000, [{count: 0}]],
        [1615878060, [{count: 0}]],
        [1615878120, [{count: 0}]],
        [1615878180, [{count: 1}]],
        [1615878240, [{count: 1}]],
        [1615878300, [{count: 1}]],
        [1615878360, [{count: 1}]],
        [1615878420, [{count: 1}]],
        [1615878480, [{count: 1}]],
        [1615878540, [{count: 1}]],
        [1615878600, [{count: 1}]],
        [1615878660, [{count: 1}]],
        [1615878720, [{count: 1}]],
        [1615878780, [{count: 1}]],
        [1615878840, [{count: 1}]],
        [1615878900, [{count: 1}]],
        [1615878960, [{count: 1}]],
        [1615879020, [{count: 1}]],
        [1615879080, [{count: 1}]],
        [1615879140, [{count: 1}]],
        [1615879200, [{count: 1}]],
        [1615879260, [{count: 1}]],
        [1615879320, [{count: 1}]],
        [1615879380, [{count: 0}]],
        [1615879440, [{count: 0}]],
        [1615879500, [{count: 0}]],
        [1615879560, [{count: 0}]],
        [1615879620, [{count: 0}]],
      ],
      order: 0,
    },
    'ludic-science,2nd event': {
      data: [
        [1615877940, [{count: 0}]],
        [1615878000, [{count: 0}]],
        [1615878060, [{count: 0}]],
        [1615878120, [{count: 0}]],
        [1615878180, [{count: 1}]],
        [1615878240, [{count: 1}]],
        [1615878300, [{count: 1}]],
        [1615878360, [{count: 1}]],
        [1615878420, [{count: 1}]],
        [1615878480, [{count: 1}]],
        [1615878540, [{count: 1}]],
        [1615878600, [{count: 1}]],
        [1615878660, [{count: 1}]],
        [1615878720, [{count: 1}]],
        [1615878780, [{count: 1}]],
        [1615878840, [{count: 1}]],
        [1615878900, [{count: 1}]],
        [1615878960, [{count: 1}]],
        [1615879020, [{count: 1}]],
        [1615879080, [{count: 1}]],
        [1615879140, [{count: 1}]],
        [1615879200, [{count: 1}]],
        [1615879260, [{count: 1}]],
        [1615879320, [{count: 1}]],
        [1615879380, [{count: 0}]],
        [1615879440, [{count: 0}]],
        [1615879500, [{count: 0}]],
        [1615879560, [{count: 0}]],
        [1615879620, [{count: 0}]],
      ],
      order: 1,
    },
  };

  const {height, width, getOption} = renderConfig.get(ChartType.SLACK_DISCOVER_TOP5);

  return (
    <Container>
      <ReactEchartsCore
        echarts={echarts}
        style={{
          height: getDimensionValue(height),
          width: getDimensionValue(width),
        }}
        opts={{height, width, renderer: 'canvas'}}
        option={getOption({stats})}
      />
    </Container>
  );
};

const Container = styled('div')`
  margin: ${space(2)};
  border: 1px solid ${p => p.theme.innerBorder};
  display: inline-block;
`;
