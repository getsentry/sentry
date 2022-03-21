import * as React from 'react';
import round from 'lodash/round';

import AsyncComponent from 'sentry/components/asyncComponent';
import {
  getDiffInMinutes,
  shouldFetchPreviousPeriod,
} from 'sentry/components/charts/utils';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import ScoreCard from 'sentry/components/scoreCard';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {Organization, PageFilters, SessionApiResponse, SessionField} from 'sentry/types';
import {defined, percent} from 'sentry/utils';
import {formatAbbreviatedNumber} from 'sentry/utils/formatters';
import {getPeriod} from 'sentry/utils/getPeriod';
import {displayCrashFreePercent, getCrashFreePercent} from 'sentry/views/releases/utils';
import {
  getSessionTermDescription,
  SessionTerm,
} from 'sentry/views/releases/utils/sessionTerm';

import MissingReleasesButtons from '../missingFeatureButtons/missingReleasesButtons';

type Props = AsyncComponent['props'] & {
  field: SessionField.SESSIONS | SessionField.USERS;
  hasSessions: boolean | null;
  isProjectStabilized: boolean;
  organization: Organization;
  selection: PageFilters;
  query?: string;
};

type State = AsyncComponent['state'] & {
  currentSessions: SessionApiResponse | null;
  previousSessions: SessionApiResponse | null;
};

class ProjectStabilityScoreCard extends AsyncComponent<Props, State> {
  shouldRenderBadRequests = true;

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      currentSessions: null,
      previousSessions: null,
    };
  }

  getEndpoints() {
    const {organization, selection, isProjectStabilized, hasSessions, query, field} =
      this.props;

    if (!isProjectStabilized || !hasSessions) {
      return [];
    }

    const {projects, environments: environment, datetime} = selection;
    const {period} = datetime;
    const commonQuery = {
      environment,
      project: projects[0],
      groupBy: 'session.status',
      interval: getDiffInMinutes(datetime) > 24 * 60 ? '1d' : '1h',
      query,
      field,
    };

    // Unfortunately we can't do something like statsPeriod=28d&interval=14d to get scores for this and previous interval with the single request
    // https://github.com/getsentry/sentry/pull/22770#issuecomment-758595553

    const endpoints: ReturnType<AsyncComponent['getEndpoints']> = [
      [
        'currentSessions',
        `/organizations/${organization.slug}/sessions/`,
        {
          query: {
            ...commonQuery,
            ...normalizeDateTimeParams(datetime),
          },
        },
      ],
    ];

    if (
      shouldFetchPreviousPeriod({
        start: datetime.start,
        end: datetime.end,
        period: datetime.period,
      })
    ) {
      const doubledPeriod = getPeriod(
        {period, start: undefined, end: undefined},
        {shouldDoublePeriod: true}
      ).statsPeriod;

      endpoints.push([
        'previousSessions',
        `/organizations/${organization.slug}/sessions/`,
        {
          query: {
            ...commonQuery,
            statsPeriodStart: doubledPeriod,
            statsPeriodEnd: period ?? DEFAULT_STATS_PERIOD,
          },
        },
      ]);
    }

    return endpoints;
  }

  get cardTitle() {
    return this.props.field === SessionField.SESSIONS
      ? t('Crash Free Sessions')
      : t('Crash Free Users');
  }

  get cardHelp() {
    return getSessionTermDescription(
      this.props.field === SessionField.SESSIONS
        ? SessionTerm.CRASH_FREE_SESSIONS
        : SessionTerm.CRASH_FREE_USERS,
      null
    );
  }

  get score() {
    const {currentSessions} = this.state;

    return this.calculateCrashFree(currentSessions);
  }

  get trend() {
    const {previousSessions} = this.state;

    const previousScore = this.calculateCrashFree(previousSessions);

    if (!defined(this.score) || !defined(previousScore)) {
      return undefined;
    }

    return round(this.score - previousScore, 3);
  }

  get trendStatus(): React.ComponentProps<typeof ScoreCard>['trendStatus'] {
    if (!this.trend) {
      return undefined;
    }

    return this.trend > 0 ? 'good' : 'bad';
  }

  componentDidUpdate(prevProps: Props) {
    const {selection, isProjectStabilized, hasSessions, query} = this.props;

    if (
      prevProps.selection !== selection ||
      prevProps.hasSessions !== hasSessions ||
      prevProps.isProjectStabilized !== isProjectStabilized ||
      prevProps.query !== query
    ) {
      this.remountComponent();
    }
  }

  calculateCrashFree(data?: SessionApiResponse | null) {
    const {field} = this.props;

    if (!data) {
      return undefined;
    }

    const totalSessions = data.groups.reduce(
      (acc, group) => acc + group.totals[field],
      0
    );

    const crashedSessions = data.groups.find(
      group => group.by['session.status'] === 'crashed'
    )?.totals[field];

    if (totalSessions === 0 || !defined(totalSessions) || !defined(crashedSessions)) {
      return undefined;
    }

    const crashedSessionsPercent = percent(crashedSessions, totalSessions);

    return getCrashFreePercent(100 - crashedSessionsPercent);
  }

  renderLoading() {
    return this.renderBody();
  }

  renderMissingFeatureCard() {
    const {organization} = this.props;
    return (
      <ScoreCard
        title={this.cardTitle}
        help={this.cardHelp}
        score={<MissingReleasesButtons organization={organization} health />}
      />
    );
  }

  renderScore() {
    const {loading} = this.state;

    if (loading || !defined(this.score)) {
      return '\u2014';
    }

    return displayCrashFreePercent(this.score);
  }

  renderTrend() {
    const {loading} = this.state;

    if (loading || !defined(this.score) || !defined(this.trend)) {
      return null;
    }

    return (
      <div>
        {this.trend >= 0 ? (
          <IconArrow direction="up" size="xs" />
        ) : (
          <IconArrow direction="down" size="xs" />
        )}
        {`${formatAbbreviatedNumber(Math.abs(this.trend))}\u0025`}
      </div>
    );
  }

  renderBody() {
    const {hasSessions} = this.props;

    if (hasSessions === false) {
      return this.renderMissingFeatureCard();
    }

    return (
      <ScoreCard
        title={this.cardTitle}
        help={this.cardHelp}
        score={this.renderScore()}
        trend={this.renderTrend()}
        trendStatus={this.trendStatus}
      />
    );
  }
}

export default ProjectStabilityScoreCard;
