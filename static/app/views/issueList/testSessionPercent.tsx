import 'echarts/lib/chart/scatter';

import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {EChartOption} from 'echarts';
import moment from 'moment';
import * as qs from 'query-string';

import {Client} from 'app/api';
import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import BaseChart from 'app/components/charts/baseChart';
import MarkLine from 'app/components/charts/components/markLine';
import Input from 'app/components/forms/input';
import * as Layout from 'app/components/layouts/thirds';
import Link from 'app/components/links/link';
import space from 'app/styles/space';
import {GlobalSelection, Group, GroupStats} from 'app/types';
import {getUtcDateString} from 'app/utils/dates';
import theme from 'app/utils/theme';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';

type Props = {
  selection: GlobalSelection;
  params: {orgId: string};
  api: Client;
};

const timePeriods = [-1, -2, -3, -4, -5, -6, -7];
const defaultValue = '0.1';

function ScatterSeries(props: EChartOption.SeriesScatter): EChartOption.SeriesScatter {
  return {
    symbolSize: theme.charts.symbolSize,
    ...props,
    type: 'scatter',
  };
}

function SessionPercent({params, api, selection}: Props) {
  const [threshold, setThreshold] = useState(defaultValue);
  const [dataArr, setData] = useState(timePeriods.map(() => [] as Group[]));
  const [statsArr, setStats] = useState<Array<Record<string, number>>>([]);

  const requestParams = {
    expand: 'sessions',
    display: 'sessions',
    project: selection.projects,
    query: 'is:unresolved',
    sort: 'freq',
  };

  const fetchData = async () => {
    let promises = timePeriods.map(period => {
      const start = getUtcDateString(
        moment().subtract(Math.abs(period), 'hours').toDate()
      );
      const end = getUtcDateString(
        moment()
          .subtract(Math.abs(period) - 1, 'hours')
          .toDate()
      );
      const query = {...requestParams, start, end, limit: 20};
      return api.requestPromise(`/organizations/${params.orgId}/issues/`, {
        method: 'GET',
        data: qs.stringify(query),
      });
    });

    let results: Group[][];
    try {
      results = await Promise.all(promises);
    } catch {
      results = [];
    }

    promises = timePeriods.map((period, idx) => {
      const start = getUtcDateString(
        moment().subtract(Math.abs(period), 'hours').toDate()
      );
      const end = getUtcDateString(
        moment()
          .subtract(Math.abs(period) - 1, 'hours')
          .toDate()
      );

      const query = {
        ...requestParams,
        start,
        end,
        groups: results[idx]?.map(group => group.id) ?? [],
      };
      if (query.groups.length === 0) {
        return Promise.resolve([]);
      }

      return api.requestPromise(`/organizations/${params.orgId}/issues-stats/`, {
        method: 'GET',
        data: qs.stringify(query),
      });
    });
    let statsResults: GroupStats[][];
    try {
      statsResults = await Promise.all(promises);
    } catch {
      statsResults = [];
    }
    const statsMap = statsResults.map(issueStats => {
      const issueStatsMap = issueStats.reduce((acc, {id, sessionCount, count}) => {
        acc[id] = sessionCount ? (Number(count) / Number(sessionCount)) * 100 : 100;
        return acc;
      }, {});
      return issueStatsMap;
    });

    setStats(statsMap);
    setData(results);
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <Fragment>
      <Layout.Header>
        <Layout.HeaderContent>
          <Layout.Title>Session Threshold Percent</Layout.Title>
          <StyledInput
            type="text"
            value={threshold}
            onChange={(event: React.ChangeEvent<HTMLInputElement>) => {
              setThreshold(event.target.value);
            }}
          />
        </Layout.HeaderContent>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main fullWidth>
          <BaseChart
            grid={{
              left: 0,
              right: space(2),
              top: space(2),
              bottom: 0,
            }}
            series={[
              ScatterSeries({
                data: timePeriods
                  .map((period, idx) => {
                    const data = dataArr[idx] ?? [];
                    const stats = statsArr[idx] ?? [];
                    return data
                      .filter(group => stats[group.id] !== undefined)
                      .map(group => ({
                        name: group.title,
                        value: [period, stats[group.id]],
                      }));
                  })
                  .flat()
                  .reverse(),
                animation: false,
                animationThreshold: 1,
                animationDuration: 0,
                tooltip: {
                  formatter: (data: any) => {
                    return [
                      `<div class="tooltip-series"><div>`,
                      `<span class="tooltip-label">${data.name}</span>${data.value[1]}%`,
                      `</div></div>`,
                      `<div class="tooltip-date">${data.value[0]} hours</div>`,
                      `<div class="tooltip-arrow"></div>`,
                    ].join('');
                  },
                },
              }),
              {
                seriesName: 'Threshold',
                type: 'line',
                markLine: MarkLine({
                  silent: true,
                  lineStyle: {color: theme.gray200},
                  data: [
                    {
                      yAxis: threshold,
                    } as any,
                  ],
                  label: {
                    show: true,
                    position: 'insideEndTop',
                    formatter: 'Threshold',
                    color: theme.gray200,
                    fontSize: 10,
                  } as any,
                }),
                data: [],
                animation: false,
                animationThreshold: 1,
                animationDuration: 0,
              } as any,
            ]}
          />

          {timePeriods.map((period, idx) => {
            const data = dataArr[idx] ?? [];
            const stats = statsArr[idx] ?? [];
            return (
              <Fragment key={idx}>
                <h4>{period} hours</h4>
                <ul>
                  {data
                    .filter(group => stats[group.id] > parseFloat(threshold))
                    .map(group => (
                      <li key={group.id}>
                        {stats[group.id].toLocaleString()}% -{' '}
                        <Link to={`/organizations/${params.orgId}/issues/${group.id}/`}>
                          {group.title}
                        </Link>
                      </li>
                    ))}
                </ul>
              </Fragment>
            );
          })}
        </Layout.Main>
      </Layout.Body>
    </Fragment>
  );
}

function SessionPercentWrapper(props: Props) {
  return (
    <Feature
      features={['issue-percent-filters']}
      renderDisabled={p => <FeatureDisabled features={p.features} hideHelpToggle />}
    >
      <SessionPercent {...props} />
    </Feature>
  );
}

export default withApi(withGlobalSelection(SessionPercentWrapper));

const StyledInput = styled(Input)`
  width: 100px;
`;
