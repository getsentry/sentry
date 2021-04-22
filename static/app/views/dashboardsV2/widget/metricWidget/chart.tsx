import React from 'react';
import * as ReactRouter from 'react-router';
import {withTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {Location} from 'history';

import ChartZoom from 'app/components/charts/chartZoom';
import ErrorPanel from 'app/components/charts/errorPanel';
import LineChart from 'app/components/charts/lineChart';
import TransitionChart from 'app/components/charts/transitionChart';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import {getSeriesSelection} from 'app/components/charts/utils';
import LoadingIndicator from 'app/components/loadingIndicator';
import Placeholder from 'app/components/placeholder';
import {PlatformKey} from 'app/data/platformCategories';
import {IconWarning} from 'app/icons';
import {GlobalSelection} from 'app/types';
import {Series} from 'app/types/echarts';
import getDynamicText from 'app/utils/getDynamicText';
import {Theme} from 'app/utils/theme';
import {sessionTerm} from 'app/views/releases/utils/sessionTerm';

type Props = {
  series: Series[];
  location: Location;
  isLoading: boolean;
  errored: boolean;
  selection: GlobalSelection;
  router: ReactRouter.InjectedRouter;
  theme: Theme;
  platform?: PlatformKey;
};

function Chart({
  series: timeseriesResults,
  location,
  errored,
  isLoading,
  selection,
  router,
  theme,
  platform,
}: Props) {
  const {datetime} = selection;
  const {utc, period, start, end} = datetime;

  const filteredTimeseriesResults = timeseriesResults.filter(({seriesName}) => {
    // There is no concept of Abnormal sessions in javascript
    if (
      (seriesName === sessionTerm.abnormal || seriesName === sessionTerm.otherAbnormal) &&
      platform &&
      ['javascript', 'node'].includes(platform)
    ) {
      return false;
    }

    return true;
  });

  const legend = {
    right: 10,
    top: 0,
    selected: getSeriesSelection(location),
  };

  const colors = timeseriesResults
    ? theme.charts.getColorPalette(timeseriesResults.length - 2)
    : [];

  // Create a list of series based on the order of the fields,
  const series = filteredTimeseriesResults
    ? filteredTimeseriesResults.map((values, index) => ({
        ...values,
        color: colors[index],
      }))
    : [];

  return (
    <ChartZoom router={router} period={period} utc={utc} start={start} end={end}>
      {zoomRenderProps => {
        if (errored) {
          return (
            <ErrorPanel>
              <IconWarning color="gray300" size="lg" />
            </ErrorPanel>
          );
        }

        return (
          <TransitionChart loading={isLoading} reloading={isLoading}>
            <LoadingScreen loading={isLoading} />
            {getDynamicText({
              value: (
                <LineChart
                  {...zoomRenderProps}
                  legend={legend}
                  series={series}
                  grid={{
                    left: '0px',
                    right: '10px',
                    top: '30px',
                    bottom: '0px',
                  }}
                />
              ),
              fixed: <Placeholder height="200px" testId="skeleton-ui" />,
            })}
          </TransitionChart>
        );
      }}
    </ChartZoom>
  );
}

export default withTheme(Chart);

const LoadingScreen = ({loading}: {loading: boolean}) => {
  if (!loading) {
    return null;
  }
  return (
    <StyledTransparentLoadingMask visible={loading}>
      <LoadingIndicator mini />
    </StyledTransparentLoadingMask>
  );
};

const StyledTransparentLoadingMask = styled(props => (
  <TransparentLoadingMask {...props} maskBackgroundColor="transparent" />
))`
  display: flex;
  justify-content: center;
  align-items: center;
`;
