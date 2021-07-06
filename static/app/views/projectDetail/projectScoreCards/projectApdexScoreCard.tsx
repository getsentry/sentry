import * as React from 'react';
import round from 'lodash/round';

import AsyncComponent from 'app/components/asyncComponent';
import Count from 'app/components/count';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {parseStatsPeriod} from 'app/components/organizations/timeRangeSelector/utils';
import ScoreCard from 'app/components/scoreCard';
import {IconArrow} from 'app/icons';
import {t} from 'app/locale';
import {GlobalSelection, Organization} from 'app/types';
import {defined} from 'app/utils';
import {TableData} from 'app/utils/discover/discoverQuery';
import {getAggregateAlias} from 'app/utils/discover/fields';
import {getPeriod} from 'app/utils/getPeriod';
import {getTermHelp, PERFORMANCE_TERM} from 'app/views/performance/data';

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

    const apdexField = organization.features.includes('project-transaction-threshold')
      ? 'apdex()'
      : `apdex(${organization.apdexThreshold})`;

    const {projects, environments, datetime} = selection;
    const {period} = datetime;
    const commonQuery = {
      environment: environments,
      project: projects.map(proj => String(proj)),
      field: [apdexField],
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
    const performanceTerm = organization.features.includes(
      'project-transaction-threshold'
    )
      ? PERFORMANCE_TERM.APDEX_NEW
      : PERFORMANCE_TERM.APDEX;
    const baseHelp = getTermHelp(this.props.organization, performanceTerm);

    if (this.trend) {
      return baseHelp + t(' This shows how it has changed since the last period.');
    }

    return baseHelp;
  }

  get currentApdex() {
    const {organization} = this.props;
    const {currentApdex} = this.state;

    const apdexField = organization.features.includes('project-transaction-threshold')
      ? 'apdex()'
      : `apdex(${organization.apdexThreshold})`;

    const apdex = currentApdex?.data[0]?.[getAggregateAlias(apdexField)];

    return typeof apdex === 'undefined' ? undefined : Number(apdex);
  }

  get previousApdex() {
    const {organization} = this.props;
    const {previousApdex} = this.state;

    const apdexField = organization.features.includes('project-transaction-threshold')
      ? 'apdex()'
      : `apdex(${organization.apdexThreshold})`;

    const apdex = previousApdex?.data[0]?.[getAggregateAlias(apdexField)];

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
