import {Fragment, useEffect, useState} from 'react';
import {Location} from 'history';
import pick from 'lodash/pick';
import round from 'lodash/round';

import {doSessionsRequest} from 'sentry/actionCreators/sessions';
import {Button} from 'sentry/components/button';
import {shouldFetchPreviousPeriod} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import ScoreCard from 'sentry/components/scoreCard';
import {parseStatsPeriod} from 'sentry/components/timeRangeSelector/utils';
import {URL_PARAM} from 'sentry/constants/pageFilters';
import {IconArrow} from 'sentry/icons/iconArrow';
import {t} from 'sentry/locale';
import {PageFilters} from 'sentry/types';
import {Organization, SessionApiResponse} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import {formatAbbreviatedNumber, formatPercentage} from 'sentry/utils/formatters';
import {getPeriod} from 'sentry/utils/getPeriod';
import useApi from 'sentry/utils/useApi';
import {
  getSessionTermDescription,
  SessionTerm,
} from 'sentry/views/releases/utils/sessionTerm';

type Props = {
  isProjectStabilized: boolean;
  location: Location;
  organization: Organization;
  selection: PageFilters;
  query?: string;
};

export function ProjectAnrScoreCard({
  isProjectStabilized,
  organization,
  selection,
  location,
  query,
}: Props) {
  const {environments, projects, datetime} = selection;
  const {start, end, period} = datetime;

  const api = useApi();

  const [sessionsData, setSessionsData] = useState<SessionApiResponse | null>(null);
  const [previousSessionData, setPreviousSessionsData] =
    useState<SessionApiResponse | null>(null);

  useEffect(() => {
    let unmounted = false;

    const requestData = {
      orgSlug: organization.slug,
      field: ['anr_rate()'],
      environment: environments,
      project: projects,
      query,
      includeSeries: false,
    };

    doSessionsRequest(api, {...requestData, ...normalizeDateTimeParams(datetime)}).then(
      response => {
        if (unmounted) {
          return;
        }

        setSessionsData(response);
      }
    );
    return () => {
      unmounted = true;
    };
  }, [api, datetime, environments, organization.slug, projects, query]);

  useEffect(() => {
    let unmounted = false;
    if (
      !shouldFetchPreviousPeriod({
        start,
        end,
        period,
      })
    ) {
      setPreviousSessionsData(null);
    } else {
      const requestData = {
        orgSlug: organization.slug,
        field: ['anr_rate()'],
        environment: environments,
        project: projects,
        query,
        includeSeries: false,
      };

      const {start: previousStart} = parseStatsPeriod(
        getPeriod({period, start: undefined, end: undefined}, {shouldDoublePeriod: true})
          .statsPeriod!
      );

      const {start: previousEnd} = parseStatsPeriod(
        getPeriod({period, start: undefined, end: undefined}, {shouldDoublePeriod: false})
          .statsPeriod!
      );

      doSessionsRequest(api, {
        ...requestData,
        start: previousStart,
        end: previousEnd,
      }).then(response => {
        if (unmounted) {
          return;
        }

        setPreviousSessionsData(response);
      });
    }
    return () => {
      unmounted = true;
    };
  }, [start, end, period, api, organization.slug, environments, projects, query]);

  const value = sessionsData?.groups?.[0]?.totals['anr_rate()'] ?? null;

  const previousValue = previousSessionData?.groups?.[0]?.totals['anr_rate()'] ?? null;

  const hasCurrentAndPrevious = previousValue && value;
  const trend = hasCurrentAndPrevious ? round(value - previousValue, 4) : null;
  const trendStatus = !trend ? undefined : trend < 0 ? 'good' : 'bad';

  if (!isProjectStabilized) {
    return null;
  }

  function renderTrend() {
    return trend ? (
      <Fragment>
        {trend >= 0 ? (
          <IconArrow direction="up" size="xs" />
        ) : (
          <IconArrow direction="down" size="xs" />
        )}
        {`${formatAbbreviatedNumber(Math.abs(trend))}\u0025`}
      </Fragment>
    ) : null;
  }

  const endpointPath = `/organizations/${organization.slug}/issues/`;

  const issueQuery = ['mechanism:[ANR,AppExitInfo]', query].join(' ').trim();

  const queryParams = {
    ...normalizeDateTimeParams(pick(location.query, [...Object.values(URL_PARAM)])),
    query: issueQuery,
    sort: 'freq',
  };

  const issueSearch = {
    pathname: endpointPath,
    query: queryParams,
  };

  function renderButton() {
    return (
      <Button
        data-test-id="issues-open"
        size="xs"
        to={issueSearch}
        onClick={() => {
          trackAnalytics('project_detail.open_anr_issues', {
            organization,
          });
        }}
      >
        {t('View Issues')}
      </Button>
    );
  }

  return (
    <ScoreCard
      title={t('ANR Rate')}
      help={getSessionTermDescription(SessionTerm.ANR_RATE, null)}
      score={value ? formatPercentage(value, 3) : '\u2014'}
      trend={renderTrend()}
      trendStatus={trendStatus}
      renderOpenButton={renderButton}
    />
  );
}
