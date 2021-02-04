import React from 'react';
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
};

type State = AsyncComponent['state'] & {
  currentApdex: TableData | null;
  previousApdex: TableData | null;
  noApdexEver: boolean;
};

class ProjectApdexScoreCard extends AsyncComponent<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      currentApdex: null,
      previousApdex: null,
      noApdexEver: false,
    };
  }

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

  /**
   * If there's no apdex in the time frame, check if there is one in the last 90 days (empty message differs then)
   */
  async onLoadAllEndpointsSuccess() {
    const {organization, selection} = this.props;
    const {projects} = selection;

    if (defined(this.currentApdex) || defined(this.previousApdex)) {
      this.setState({noApdexEver: false});
      return;
    }

    this.setState({loading: true});

    const response = await this.api.requestPromise(
      `/organizations/${organization.slug}/eventsv2/`,
      {
        query: {
          project: projects.map(proj => String(proj)),
          field: [`apdex(${organization.apdexThreshold})`],
          query: 'event.type:transaction count():>0',
          statsPeriod: '90d',
        },
      }
    );

    const apdex =
      response?.data[0]?.[getAggregateAlias(`apdex(${organization.apdexThreshold})`)];

    this.setState({noApdexEver: !defined(apdex), loading: false});
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
    return t('Apdex');
  }

  get cardHelp() {
    return (
      getTermHelp(this.props.organization, PERFORMANCE_TERM.APDEX) +
      t(' This shows how it has changed since the last period.')
    );
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
    if (!this.hasFeature() || this.state.noApdexEver) {
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
