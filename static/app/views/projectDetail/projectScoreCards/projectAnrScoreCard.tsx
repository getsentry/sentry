import {useEffect, useState} from 'react';
import type {Location} from 'history';
import pick from 'lodash/pick';

import {doSessionsRequest} from 'sentry/actionCreators/sessions';
import {LinkButton} from 'sentry/components/button';
import {shouldFetchPreviousPeriod} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {parseStatsPeriod} from 'sentry/components/timeRangeSelector/utils';
import {URL_PARAM} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import type {PageFilters} from 'sentry/types/core';
import type {Organization, SessionApiResponse} from 'sentry/types/organization';
import {defined} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getPeriod} from 'sentry/utils/duration/getPeriod';
import useApi from 'sentry/utils/useApi';
import {BigNumberWidgetVisualization} from 'sentry/views/dashboards/widgets/bigNumberWidget/bigNumberWidgetVisualization';
import {Widget} from 'sentry/views/dashboards/widgets/widget/widget';
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

  if (!isProjectStabilized) {
    return null;
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

  const cardTitle = t('ANR Rate');

  const cardHelp = getSessionTermDescription(SessionTerm.ANR_RATE, null);

  const Title = <Widget.WidgetTitle title={cardTitle} />;

  if (!defined(value)) {
    return (
      <Widget
        Title={Title}
        Visualization={<BigNumberWidgetVisualization.LoadingPlaceholder />}
      />
    );
  }

  return (
    <Widget
      Title={Title}
      Actions={
        <Widget.WidgetToolbar>
          <LinkButton
            size="xs"
            to={issueSearch}
            onClick={() => {
              trackAnalytics('project_detail.open_anr_issues', {
                organization,
              });
            }}
          >
            {t('View Issues')}
          </LinkButton>
          <Widget.WidgetDescription description={cardHelp} />
        </Widget.WidgetToolbar>
      }
      Visualization={
        <BigNumberWidgetVisualization
          value={value ?? undefined}
          previousPeriodValue={previousValue ?? undefined}
          field="anr_rate()"
          preferredPolarity="-"
          meta={{
            fields: {
              'anr_rate()': 'percentage',
            },
            units: {},
          }}
        />
      }
    />
  );
}
