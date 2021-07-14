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
import {t, tn} from 'app/locale';
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

type GroupWithPercent = {
  group: Group;
  percent: number;
};

function SessionPercent({params, api, selection, organization}: Props) {
  const [threshold, setThreshold] = useState(defaultValue);
  const [statsArr, setStats] = useState<GroupWithPercent[][]>([]);

  const requestParams = {
    expand: 'sessions',
    display: 'sessions',
    project: selection.projects,
    query: 'is:unresolved',
    sort: 'freq',
  };

  const fetchData = async () => {
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

      const issuesQuery = {...requestParams, limit: 5, start, end};
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
        setStats(prevState => {
          return [...prevState, []];
        });
        continue;
      }

      const query = {
        ...requestParams,
        start,
        end,
        groups: groupIds,
      };

      try {
        const groupStats: GroupStats[] = await api.requestPromise(
          `/organizations/${params.orgId}/issues-stats/`,
          {
            method: 'GET',
            data: qs.stringify(query),
          }
        );
        const newData = groupStats.map(stats => {
          return {
            group: results.find(grp => grp.id === stats.id)!,
            percent: stats.sessionCount
              ? (Number(stats.count) / Number(stats.sessionCount)) * 100
              : 100,
          };
        });
        setStats(prevState => {
          return [...prevState, newData];
        });
      } catch {
        setStats(prevState => {
          return [...prevState, []];
        });
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
          <Layout.Title>{t('Session Threshold Percent')}</Layout.Title>
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
            const isLoading = stats === undefined;

            return (
              <Fragment key={idx}>
                <h4>{tn('%s hour', '%s hours', period)}</h4>
                <ul>
                  {isLoading && t('Loading\u2026')}
                  {!isLoading &&
                    stats
                      .filter(({percent}) => percent > parseFloat(threshold))
                      .map(({group, percent}) => (
                        <li key={group.id}>
                          {percent.toLocaleString()}% -{' '}
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
