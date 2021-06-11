import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import uniq from 'lodash/uniq';
import moment from 'moment';
import * as qs from 'query-string';

import {Client} from 'app/api';
import Input from 'app/components/forms/input';
import * as Layout from 'app/components/layouts/thirds';
import Link from 'app/components/links/link';
import {GlobalSelection, Group} from 'app/types';
import {getUtcDateString} from 'app/utils/dates';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';

type Props = {
  selection: GlobalSelection;
  params: {orgId: string};
  api: Client;
};

const timePeriods = [-1, -2, -3, -4, -5, -6];
const defaultValue = '0.1';

function SessionPercent({params, api, selection}: Props) {
  const [threshold, setThreshold] = useState(defaultValue);
  const [dataArr, setData] = useState(timePeriods.map(() => [] as Group[]));
  const [stats, setStats] = useState<Record<string, number>>({});

  const requestParams = {
    expand: 'sessions',
    display: 'sessions',
    project: selection.projects,
    query: 'is:unresolved',
    sort: 'freq',
    stats_period: '14d',
  };

  const fetchData = async () => {
    const promises = timePeriods.map(period => {
      const start = getUtcDateString(
        moment().subtract(Math.abs(period), 'hours').toDate()
      );
      const end = getUtcDateString(
        moment()
          .subtract(Math.abs(period) - 1, 'hours')
          .toDate()
      );
      const query = {...requestParams, start, end};
      return api.requestPromise(`/organizations/${params.orgId}/issues/`, {
        method: 'GET',
        data: qs.stringify(query),
      });
    });
    const results: Group[][] = await Promise.all(promises);

    const query = {
      ...requestParams,
      groups: uniq(results.map(groups => groups.map(group => group.id)).flat()),
    };
    if (!query.groups) {
      setStats({});
      setData([]);
      return;
    }

    const issueStats = await api.requestPromise(
      `/organizations/${params.orgId}/issues-stats/`,
      {
        method: 'GET',
        data: qs.stringify(query),
      }
    );
    const issueStatsMap = issueStats.reduce((acc, {id, sessionCount, count}) => {
      acc[id] = (count / sessionCount) * 100;
      return acc;
    }, {});
    setStats(issueStatsMap);
    setData(results);
  };

  useEffect(() => {
    fetchData();
  }, []);

  return (
    <div>
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
          {timePeriods.map((period, idx) => {
            const data = dataArr[idx];
            return (
              <Fragment key={idx}>
                <h4>{period} hours</h4>
                <ul>
                  {data
                    .filter(group => stats[group.id] > parseFloat(threshold))
                    .map(group => (
                      <li key={group.id}>
                        {stats[group.id].toFixed(6)}% -{' '}
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
    </div>
  );
}

export default withApi(withGlobalSelection(SessionPercent));

const StyledInput = styled(Input)`
  width: 100px;
`;
