import React from 'react';
import styled from '@emotion/styled';
import echarts from 'echarts/lib/echarts';
import ReactEchartsCore from 'echarts-for-react/lib/core';

import config, {ChartType} from 'app/chartcuterieConfig';
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
        option={getOption(data)}
      />
    </Container>
  );
};

const Container = styled('div')`
  margin: ${space(2)};
  border: 1px solid ${p => p.theme.innerBorder};
  display: inline-block;
`;
