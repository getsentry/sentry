import * as React from 'react';
import round from 'lodash/round';

import AsyncComponent from 'sentry/components/asyncComponent';
import Count from 'sentry/components/count';
import {getParams} from 'sentry/components/organizations/globalSelectionHeader/getParams';
import {parseStatsPeriod} from 'sentry/components/organizations/timeRangeSelector/utils';
import ScoreCard from 'sentry/components/scoreCard';
import {IconArrow} from 'sentry/icons';
import {t} from 'sentry/locale';
import {GlobalSelection, Organization} from 'sentry/types';
import {defined} from 'sentry/utils';
import {TableData} from 'sentry/utils/discover/discoverQuery';
import {getAggregateAlias} from 'sentry/utils/discover/fields';
import {getPeriod} from 'sentry/utils/getPeriod';
import {getTermHelp, PERFORMANCE_TERM} from 'sentry/views/performance/data';

import MissingPerformanceButtons from '../missingFeatureButtons/missingPerformanceButtons';
import {shouldFetchPreviousPeriod} from '../utils';

type Props = AsyncComponent['props'] & {
  organization: Organization;
  selection: GlobalSelection;
  isProjectStabilized: boolean;
  hasTransactions?: boolean;
  query?: string;
};

type State = AsyncComponent['state'] & {
  currentApdex: TableData | null;
  previousApdex: TableData | null;
};

class ProjectApdexScoreCard extends AsyncComponent<Props, State> {
  shouldRenderBadRequests = true;

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      currentApdex: null,
      previousApdex: null,
    };
  }

  getEndpoints() {
    const {organization, selection, isProjectStabilized, hasTransactions, query} =
      this.props;

    if (!this.hasFeature() || !isProjectStabilized || !hasTransactions) {
      return [];
    }

    const {projects, environments, datetime} = selection;
    const {period} = datetime;
    const commonQuery = {
      environment: environments,
      project: projects.map(proj => String(proj)),
      field: ['apdex()'],
      query: ['event.type:transaction count():>0', query].join(' ').trim(),
    };
    const endpoints: ReturnType<AsyncComponent['getEndpoints']> = [
      [
        'currentApdex',
        `/organizations/${organization.slug}/eventsv2/`,
        {query: {...commonQuery, ...getParams(datetime)}},
      ],
    ];

    if (shouldFetchPreviousPeriod(datetime)) {
      const {start: previousStart} = parseStatsPeriod(
        getPeriod({period, start: undefined, end: undefined}, {shouldDoublePeriod: true})
          .statsPeriod!
      );

      const {start: previousEnd} = parseStatsPeriod(
        getPeriod({period, start: undefined, end: undefined}, {shouldDoublePeriod: false})
          .statsPeriod!
      );

      endpoints.push([
        'previousApdex',
        `/organizations/${organization.slug}/eventsv2/`,
        {query: {...commonQuery, start: previousStart, end: previousEnd}},
      ]);
    }

    return endpoints;
  }

  componentDidUpdate(prevProps: Props) {
    const {selection, isProjectStabilized, hasTransactions, query} = this.props;

    if (
      prevProps.selection !== selection ||
      prevProps.hasTransactions !== hasTransactions ||
      prevProps.isProjectStabilized !== isProjectStabilized ||
      prevProps.query !== query
    ) {
      this.remountComponent();
    }
  }

  hasFeature() {
    return this.props.organization.features.includes('performance-view');
  }

  get cardTitle() {
    return t('Apdex');
  }

  get cardHelp() {
    const {organization} = this.props;
    const baseHelp = getTermHelp(organization, PERFORMANCE_TERM.APDEX_NEW);

    if (this.trend) {
      return baseHelp + t(' This shows how it has changed since the last period.');
    }

    return baseHelp;
  }

  get currentApdex() {
    const {currentApdex} = this.state;

    const apdex = currentApdex?.data[0]?.[getAggregateAlias('apdex()')];

    return typeof apdex === 'undefined' ? undefined : Number(apdex);
  }

  get previousApdex() {
    const {previousApdex} = this.state;

    const apdex = previousApdex?.data[0]?.[getAggregateAlias('apdex()')];

    return typeof apdex === 'undefined' ? undefined : Number(apdex);
  }

  get trend() {
    if (this.currentApdex && this.previousApdex) {
      return round(this.currentApdex - this.previousApdex, 3);
    }

    return null;
  }

  get trendStatus(): React.ComponentProps<typeof ScoreCard>['trendStatus'] {
    if (!this.trend) {
      return undefined;
    }

    return this.trend > 0 ? 'good' : 'bad';
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
        score={<MissingPerformanceButtons organization={organization} />}
      />
    );
  }

  renderScore() {
    return defined(this.currentApdex) ? <Count value={this.currentApdex} /> : '\u2014';
  }

  renderTrend() {
    // we want to show trend only after currentApdex has loaded to prevent jumping
    return defined(this.currentApdex) && defined(this.trend) ? (
      <React.Fragment>
        {this.trend >= 0 ? (
          <IconArrow direction="up" size="xs" />
        ) : (
          <IconArrow direction="down" size="xs" />
        )}
        <Count value={Math.abs(this.trend)} />
      </React.Fragment>
    ) : null;
  }

  renderBody() {
    const {hasTransactions} = this.props;

    if (!this.hasFeature() || hasTransactions === false) {
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

export default ProjectApdexScoreCard;
