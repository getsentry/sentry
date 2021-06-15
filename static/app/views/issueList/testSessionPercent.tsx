import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';
import range from 'lodash/range';
import moment from 'moment';
import * as qs from 'query-string';

import {Client} from 'app/api';
import Feature from 'app/components/acl/feature';
import FeatureDisabled from 'app/components/acl/featureDisabled';
import Input from 'app/components/forms/input';
import * as Layout from 'app/components/layouts/thirds';
import Link from 'app/components/links/link';
import {
  GlobalSelection,
  Group,
  GroupStats,
  Organization,
  SavedQueryVersions,
} from 'app/types';
import {getUtcDateString} from 'app/utils/dates';
import EventView from 'app/utils/discover/eventView';
import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import withOrganization from 'app/utils/withOrganization';

type Props = {
  selection: GlobalSelection;
  params: {orgId: string};
  organization: Organization;
  api: Client;
};

const timePeriods = range(-1, -24 * 7, -1);
const defaultValue = '0.1';

function SessionPercent({params, api, selection, organization}: Props) {
  const [threshold, setThreshold] = useState(defaultValue);
  const [groups, setGroups] = useState<Group[]>([]);
  const [statsArr, setStats] = useState<Array<Record<string, number>>>([]);

  const requestParams = {
    expand: 'sessions',
    display: 'sessions',
    project: selection.projects,
    query: 'is:unresolved',
    sort: 'freq',
  };

  const fetchData = async () => {
    const issuesQuery = {...requestParams, limit: 25, statsPeriod: '7d'};
    let results: Group[];
    try {
      results = await api.requestPromise(`/organizations/${params.orgId}/issues/`, {
        method: 'GET',
        data: qs.stringify(issuesQuery),
      });
    } catch {
      results = [];
    }

    const groupIds = results.map(group => group.id);
    if (groupIds.length === 0) {
      setStats([]);
      setGroups([]);
      return;
    }

    setGroups(results);

    const statsResults: GroupStats[][] = [];
    for (let idx = 0; idx < timePeriods.length; idx++) {
      const period = timePeriods[idx];
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
        groups: groupIds,
      };

      try {
        const stats = await api.requestPromise(
          `/organizations/${params.orgId}/issues-stats/`,
          {
            method: 'GET',
            data: qs.stringify(query),
          }
        );
        statsResults.push(stats);

        const statsMap = statsResults.map(issueStats => {
          const issueStatsMap = issueStats.reduce((acc, {id, sessionCount, count}) => {
            if (Number(count) !== 0) {
              acc[id] = sessionCount ? (Number(count) / Number(sessionCount)) * 100 : 100;
            }
            return acc;
          }, {});
          return issueStatsMap;
        });

        setStats(statsMap);
      } catch {
        // pass
      }
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  function getDiscoverUrl({title, id, type}: Group, period: number) {
    const start = getUtcDateString(
      moment()
        .subtract(Math.abs(period - 2), 'hours')
        .toDate()
    );
    const end = getUtcDateString(
      moment()
        .subtract(Math.abs(period) - 3, 'hours')
        .toDate()
    );
    const discoverQuery = {
      id: undefined,
      name: title || type,
      fields: ['title', 'release', 'environment', 'user.display', 'timestamp'],
      orderby: '-timestamp',
      query: `issue.id:${id}`,
      projects: selection.projects,
      version: 2 as SavedQueryVersions,
      start,
      end,
    };

    const discoverView = EventView.fromSavedQuery(discoverQuery);
    return discoverView.getResultsViewUrlTarget(organization.slug);
  }

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
          {timePeriods.map((period, idx) => {
            const stats = statsArr[idx];

            if (!stats) {
              return null;
            }

            return (
              <Fragment key={idx}>
                <h4>{period} hours</h4>
                <ul>
                  {groups
                    .filter(
                      group => stats[group.id] && stats[group.id] > parseFloat(threshold)
                    )
                    .map(group => (
                      <li key={group.id}>
                        {stats[group.id].toLocaleString()}% -{' '}
                        <Link to={getDiscoverUrl(group, period)}>{group.title}</Link>
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

export default withApi(withGlobalSelection(withOrganization(SessionPercentWrapper)));

const StyledInput = styled(Input)`
  width: 100px;
`;
