import * as ReactRouter from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import compact from 'lodash/compact';
import pick from 'lodash/pick';
import moment from 'moment';

import {Client} from 'app/api';
import AsyncComponent from 'app/components/asyncComponent';
import ChartZoom from 'app/components/charts/chartZoom';
import LineChart from 'app/components/charts/lineChart';
import {
  HeaderTitleLegend,
  InlineContainer,
  SectionHeading,
  SectionValue,
} from 'app/components/charts/styles';
import TransitionChart from 'app/components/charts/transitionChart';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import {
  DateTimeObject,
  getDiffInMinutes,
  ONE_WEEK,
  truncationFormatter,
} from 'app/components/charts/utils';
import Count from 'app/components/count';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {Panel, PanelBody, PanelFooter} from 'app/components/panels';
import Placeholder from 'app/components/placeholder';
import {URL_PARAM} from 'app/constants/globalSelectionHeader';
import {t, tct, tn} from 'app/locale';
import space from 'app/styles/space';
import {GlobalSelection, Organization, SessionApiResponse} from 'app/types';
import {percent} from 'app/utils';
import {formatVersion} from 'app/utils/formatters';
import withApi from 'app/utils/withApi';
import {DisplayOption} from 'app/views/releases/list/utils';
import {
  reduceTimeSeriesGroups,
  sessionDisplayToField,
} from 'app/views/releases/utils/releaseHealthRequest';

type Props = AsyncComponent['props'] & {
  api: Client;
  organization: Organization;
  selection: GlobalSelection;
  activeDisplay: DisplayOption;
  location: Location;
  router: ReactRouter.InjectedRouter;
};

type State = AsyncComponent['state'] & {
  sessions: SessionApiResponse | null;
};

type GetIntervalOptions = {
  highFidelity?: boolean;
};

// TODO(release-adoption-chart): refactor duplication
function getInterval(
  datetimeObj: DateTimeObject,
  {highFidelity}: GetIntervalOptions = {}
) {
  const diffInMinutes = getDiffInMinutes(datetimeObj);

  if (
    highFidelity &&
    diffInMinutes < 360 // limit on backend is set to six hour
  ) {
    return '10m';
  }

  if (diffInMinutes >= ONE_WEEK) {
    return '1d';
  } else {
    return '1h';
  }
}
class ReleaseAdoptionChart extends AsyncComponent<Props, State> {
  shouldReload = true;

  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {organization, location, activeDisplay} = this.props;

    return [
      [
        'sessions',
        `/organizations/${organization.slug}/sessions/`,
        {
          query: {
            interval: getInterval(
              {
                start: location.query.start,
                end: location.query.start,
                period: location.query.statsPeriod,
                utc: location.query.utc,
              },
              {
                highFidelity: organization.features.includes(
                  'minute-resolution-sessions'
                ),
              }
            ),
            ...getParams(pick(location.query, Object.values(URL_PARAM))),
            groupBy: ['release'],
            field: [sessionDisplayToField(activeDisplay)],
            query: location.query.query ? `release:${location.query.query}` : undefined,
          },
        },
      ],
    ];
  }

  getReleasesSeries() {
    const {activeDisplay} = this.props;
    const {sessions} = this.state;
    const releases = sessions?.groups.map(group => group.by.release);

    if (!releases) {
      return null;
    }

    const totalData = sessions?.groups?.reduce(
      (acc, group) =>
        reduceTimeSeriesGroups(acc, group, sessionDisplayToField(activeDisplay)),
      [] as number[]
    );

    return releases.map(release => {
      const releaseData = sessions?.groups.find(({by}) => by.release === release)?.series[
        sessionDisplayToField(activeDisplay)
      ];
      return {
        id: release as string,
        seriesName: formatVersion(release as string),
        data:
          sessions?.intervals.map((interval, index) => ({
            name: moment(interval).valueOf(),
            value: percent(releaseData?.[index] ?? 0, totalData?.[index] ?? 0),
          })) ?? [],
      };
    });
  }

  getTotal() {
    const {activeDisplay} = this.props;
    const {sessions} = this.state;

    return (
      sessions?.groups.reduce(
        (acc, group) => acc + group.totals[sessionDisplayToField(activeDisplay)],
        0
      ) || 0
    );
  }

  handleClick = (params: {seriesId: string}) => {
    const {organization, router, selection, location} = this.props;

    const project = selection.projects[0];

    router.push({
      pathname: `/organizations/${organization?.slug}/releases/${encodeURIComponent(
        params.seriesId
      )}/`,
      query: {project, environment: location.query.environment},
    });
  };

  renderEmpty() {
    return (
      <Panel>
        <PanelBody withPadding>
          <ChartHeader>
            <Placeholder height="24px" />
          </ChartHeader>
          <Placeholder height="200px" />
        </PanelBody>
        <ChartFooter>
          <Placeholder height="34px" />
        </ChartFooter>
      </Panel>
    );
  }

  render() {
    const {activeDisplay, router, selection} = this.props;
    const {start, end, period, utc} = selection.datetime;
    const {loading, reloading} = this.state;
    const releasesSeries = this.getReleasesSeries();
    const totalCount = this.getTotal();

    if ((loading && !reloading) || (reloading && totalCount === 0)) {
      return this.renderEmpty();
    }

    if (!releasesSeries?.length) {
      return null;
    }

    return (
      <Panel>
        <PanelBody withPadding>
          <ChartHeader>
            <ChartTitle>{t('Releases Adopted')}</ChartTitle>
          </ChartHeader>
          <TransitionChart loading={loading} reloading={reloading}>
            <TransparentLoadingMask visible={reloading} />
            <ChartZoom router={router} period={period} utc={utc} start={start} end={end}>
              {zoomRenderProps => (
                <LineChart
                  {...zoomRenderProps}
                  grid={{left: '10px', right: '10px', top: '40px', bottom: '0px'}}
                  series={releasesSeries}
                  yAxis={{
                    min: 0,
                    max: 100,
                    type: 'value',
                    interval: 10,
                    splitNumber: 10,
                    data: [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100],
                    axisLabel: {
                      formatter: '{value}%',
                    },
                  }}
                  tooltip={{
                    formatter: seriesParams => {
                      const series = Array.isArray(seriesParams)
                        ? seriesParams
                        : [seriesParams];
                      const timestamp = series[0].data[0];
                      const [first, second, third, ...rest] = series
                        .filter(s => s.data[1] > 0)
                        .sort((a, b) => b.data[1] - a.data[1]);

                      const restSum = rest.reduce((acc, s) => acc + s.data[1], 0);

                      const seriesToRender = compact([first, second, third]);

                      if (rest.length) {
                        seriesToRender.push({
                          seriesName: tn('%s Other', '%s Others', rest.length),
                          data: [timestamp, restSum],
                          marker:
                            '<span style="display:inline-block;margin-right:5px;border-radius:10px;width:10px;height:10px;"></span>',
                        });
                      }

                      if (!seriesToRender.length) {
                        return '<div/>';
                      }

                      return [
                        '<div class="tooltip-series">',
                        seriesToRender
                          .map(
                            s =>
                              `<div><span class="tooltip-label">${s.marker}<strong>${
                                s.seriesName && truncationFormatter(s.seriesName, 12)
                              }</strong></span>${s.data[1].toFixed(2)}%</div>`
                          )
                          .join(''),
                        '</div>',
                        `<div class="tooltip-date">${moment(timestamp).format(
                          'MMM D, YYYY LT'
                        )}</div>`,
                        `<div class="tooltip-arrow"></div>`,
                      ].join('');
                    },
                  }}
                  onClick={this.handleClick}
                />
              )}
            </ChartZoom>
          </TransitionChart>
        </PanelBody>
        <ChartFooter>
          <InlineContainer>
            <SectionHeading>
              {tct('Total [display]', {
                display: activeDisplay === DisplayOption.USERS ? 'Users' : 'Sessions',
              })}
            </SectionHeading>
            <SectionValue>
              <Count value={totalCount || 0} />
            </SectionValue>
          </InlineContainer>
        </ChartFooter>
      </Panel>
    );
  }
}

export default withApi(ReleaseAdoptionChart);

const ChartHeader = styled(HeaderTitleLegend)`
  margin-bottom: ${space(1)};
`;

const ChartTitle = styled('header')`
  display: flex;
  flex-direction: row;
`;

const ChartFooter = styled(PanelFooter)`
  display: flex;
  align-items: center;
  padding: ${space(1)} 20px;
`;
