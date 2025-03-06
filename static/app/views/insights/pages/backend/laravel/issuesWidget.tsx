import pick from 'lodash/pick';

import GroupList from 'sentry/components/issues/groupList';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import {DEFAULT_RELATIVE_PERIODS, DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {URL_PARAM} from 'sentry/constants/pageFilters';
import {t, tct} from 'sentry/locale';
import {decodeScalar} from 'sentry/utils/queryString';
import useApi from 'sentry/utils/useApi';
import {useBreakpoints} from 'sentry/utils/useBreakpoints';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {usePageFilterChartParams} from 'sentry/views/insights/pages/backend/laravel/utils';
import NoGroupsHandler from 'sentry/views/issueList/noGroupsHandler';

export function IssuesWidget({query = ''}: {query?: string}) {
  const api = useApi();
  const organization = useOrganization();
  const location = useLocation();

  const pageFilterChartParams = usePageFilterChartParams({granularity: 'spans-low'});
  const queryWithDefault = `is:unresolved ${query}`.trim();

  const queryParams = {
    limit: '5',
    ...normalizeDateTimeParams(
      pick(location.query, [...Object.values(URL_PARAM), 'cursor'])
    ),
    queryWithDefault,
    sort: 'freq',
  };

  const breakpoints = useBreakpoints();

  function renderEmptyMessage() {
    const selectedTimePeriod = location.query.start
      ? null
      : DEFAULT_RELATIVE_PERIODS[
          decodeScalar(
            location.query.statsPeriod,
            DEFAULT_STATS_PERIOD
          ) as keyof typeof DEFAULT_RELATIVE_PERIODS
        ];
    const displayedPeriod = selectedTimePeriod
      ? selectedTimePeriod.toLowerCase()
      : t('given timeframe');

    return (
      <Panel style={{display: 'flex', justifyContent: 'center', alignItems: 'center'}}>
        <PanelBody>
          <NoGroupsHandler
            api={api}
            organization={organization}
            query={queryWithDefault}
            selectedProjectIds={pageFilterChartParams.project}
            groupIds={[]}
            emptyMessage={tct('No [issuesType] issues for the [timePeriod].', {
              issuesType: '',
              timePeriod: displayedPeriod,
            })}
          />
        </PanelBody>
      </Panel>
    );
  }

  // TODO(aknaus): Remove GroupList and use StreamGroup directly
  return (
    <GroupList
      orgSlug={organization.slug}
      queryParams={queryParams}
      canSelectGroups={false}
      renderEmptyMessage={renderEmptyMessage}
      withChart={breakpoints.xlarge}
      withPagination={false}
    />
  );
}
