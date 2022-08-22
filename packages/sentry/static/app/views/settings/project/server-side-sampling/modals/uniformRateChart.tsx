import styled from '@emotion/styled';

import {BarChart} from 'sentry/components/charts/barChart';
import {ChartContainer, HeaderTitle} from 'sentry/components/charts/styles';
import {Panel} from 'sentry/components/panels';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {Series} from 'sentry/types/echarts';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import getDynamicText from 'sentry/utils/getDynamicText';

type Props = {
  series: Series[];
};

function UniformRateChart({series}: Props) {
  const legend = {
    right: 10,
    top: 5,
    data: series.map(s => s.seriesName),
  };

  return (
    <ChartPanel>
      <ChartContainer>
        <HeaderTitle>{t('Transactions (Last 30 days) ')}</HeaderTitle>
        {getDynamicText({
          value: (
            <BarChart
              legend={legend}
              series={series}
              grid={{
                left: '10px',
                right: '10px',
                top: '40px',
                bottom: '0px',
              }}
              height={200}
              isGroupedByDate
              showTimeInTooltip={false}
              tooltip={{valueFormatter: value => formatAbbreviatedNumber(value)}}
              yAxis={{
                axisLabel: {
                  formatter: (value: number) => formatAbbreviatedNumber(value),
                },
              }}
            />
          ),

          fixed: <Placeholder height="224px" />,
        })}
      </ChartContainer>
    </ChartPanel>
  );
}

const ChartPanel = styled(Panel)`
  margin-bottom: 0;
  border-bottom-left-radius: 0;
  border-bottom: none;
  border-bottom-right-radius: 0;
`;

export {UniformRateChart};
