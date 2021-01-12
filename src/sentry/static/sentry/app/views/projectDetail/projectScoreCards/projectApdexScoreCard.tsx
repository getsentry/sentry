import React from 'react';

import AsyncComponent from 'app/components/asyncComponent';
import {canIncludePreviousPeriod} from 'app/components/charts/utils';
import Count from 'app/components/count';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {parseStatsPeriod} from 'app/components/organizations/timeRangeSelector/utils';
import ScoreCard from 'app/components/scoreCard';
import {t} from 'app/locale';
import {GlobalSelection, Organization} from 'app/types';
import {defined} from 'app/utils';
import {TableData} from 'app/utils/discover/discoverQuery';
import {getAggregateAlias} from 'app/utils/discover/fields';
import {formatAbbreviatedNumber} from 'app/utils/formatters';
import {getPeriod} from 'app/utils/getPeriod';
import {getTermHelp} from 'app/views/performance/data';

import MissingPerformanceButtons from '../missingFeatureButtons/missingPerformanceButtons';

type Props = AsyncComponent['props'] & {
  organization: Organization;
  selection: GlobalSelection;
};

type State = AsyncComponent['state'] & {
  currentApdex: TableData | null;
  previousApdex: TableData | null;
};

class ProjectApdexScoreCard extends AsyncComponent<Props, State> {
  getEndpoints() {
    const {organization, selection} = this.props;

    if (!this.hasFeature()) {
      return [];
    }

    const {projects, environments, datetime} = selection;
    const {period} = datetime;
    const commonQuery = {
      environment: environments,
      project: projects.map(proj => String(proj)),
      field: [`apdex(${organization.apdexThreshold})`],
      query: 'event.type:transaction count():>0',
    };
    const endpoints: ReturnType<AsyncComponent['getEndpoints']> = [
      [
        'currentApdex',
        `/organizations/${organization.slug}/eventsv2/`,
        {query: {...commonQuery, ...getParams(datetime)}},
      ],
    ];

    if (period && canIncludePreviousPeriod(true, period)) {
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
    if (prevProps.selection !== this.props.selection) {
      this.remountComponent();
    }
  }

  hasFeature() {
    return this.props.organization.features.includes('performance-view');
  }

  get cardTitle() {
    return t('Apdex Score');
  }

  get cardHelp() {
    return getTermHelp(this.props.organization, 'apdex');
  }

  get currentApdex() {
    const {organization} = this.props;
    const {currentApdex} = this.state;

    const apdex =
      currentApdex?.data[0]?.[getAggregateAlias(`apdex(${organization.apdexThreshold})`)];

    return typeof apdex === 'undefined' ? undefined : Number(apdex);
  }

  get previousApdex() {
    const {organization} = this.props;
    const {previousApdex} = this.state;

    const apdex =
      previousApdex?.data[0]?.[
        getAggregateAlias(`apdex(${organization.apdexThreshold})`)
      ];

    return typeof apdex === 'undefined' ? undefined : Number(apdex);
  }

  get trend() {
    if (this.currentApdex && this.previousApdex) {
      return Number(formatAbbreviatedNumber(this.currentApdex - this.previousApdex));
    }

    return null;
  }

  get trendStyle(): React.ComponentProps<typeof ScoreCard>['trendStyle'] {
    if (!this.trend) {
      return undefined;
    }

    return this.trend > 0 ? 'bad' : 'good';
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
        {this.trend >= 0 ? '+' : '-'}
        <Count value={Math.abs(this.trend)} />
      </React.Fragment>
    ) : null;
  }

  renderBody() {
    if (!this.hasFeature()) {
      return this.renderMissingFeatureCard();
    }

    return (
      <ScoreCard
        title={this.cardTitle}
        help={this.cardHelp}
        score={this.renderScore()}
        trend={this.renderTrend()}
        trendStyle={this.trendStyle}
      />
    );
  }
}

export default ProjectApdexScoreCard;
