import React from 'react';

import {fetchAnyReleaseExistence} from 'app/actionCreators/projects';
import AsyncComponent from 'app/components/asyncComponent';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {parseStatsPeriod} from 'app/components/organizations/timeRangeSelector/utils';
import ScoreCard from 'app/components/scoreCard';
import {IconArrow} from 'app/icons';
import {t} from 'app/locale';
import {GlobalSelection, Organization} from 'app/types';
import {defined} from 'app/utils';
import {getPeriod} from 'app/utils/getPeriod';

import MissingReleasesButtons from '../missingFeatureButtons/missingReleasesButtons';
import {shouldFetchPreviousPeriod} from '../utils';

const API_LIMIT = 1000;

type Release = {version: string; date: string};

type Props = AsyncComponent['props'] & {
  organization: Organization;
  selection: GlobalSelection;
};

type State = AsyncComponent['state'] & {
  currentReleases: Release[] | null;
  previousReleases: Release[] | null;
  noReleaseEver: boolean;
};

class ProjectVelocityScoreCard extends AsyncComponent<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      currentReleases: null,
      previousReleases: null,
      noReleaseEver: false,
    };
  }

  getEndpoints() {
    const {organization, selection} = this.props;

    const {projects, environments, datetime} = selection;
    const {period} = datetime;
    const commonQuery = {
      environment: environments,
      project: projects[0],
    };
    const endpoints: ReturnType<AsyncComponent['getEndpoints']> = [
      [
        'currentReleases',
        `/organizations/${organization.slug}/releases/stats/`,
        {
          includeAllArgs: true,
          method: 'GET',
          query: {
            ...commonQuery,
            ...getParams(datetime),
          },
        },
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
        'previousReleases',
        `/organizations/${organization.slug}/releases/stats/`,
        {
          query: {
            ...commonQuery,
            start: previousStart,
            end: previousEnd,
          },
        },
      ]);
    }

    return endpoints;
  }

  /**
   * If our releases are empty, determine if we had a release in the last 90 days (empty message differs then)
   */
  async onLoadAllEndpointsSuccess() {
    const {currentReleases, previousReleases} = this.state;
    const {organization, selection} = this.props;

    if ([...(currentReleases ?? []), ...(previousReleases ?? [])].length !== 0) {
      this.setState({noReleaseEver: false});
      return;
    }

    this.setState({loading: true});

    const hasOlderReleases = await fetchAnyReleaseExistence(
      this.api,
      organization.slug,
      selection.projects[0]
    );

    this.setState({noReleaseEver: !hasOlderReleases, loading: false});
  }

  get cardTitle() {
    return t('Number of Releases');
  }

  get cardHelp() {
    return t(
      'The number of releases for this project and how it has changed since the last period.'
    );
  }

  get trend() {
    const {currentReleases, previousReleases} = this.state;

    if (!defined(currentReleases) || !defined(previousReleases)) {
      return null;
    }

    return currentReleases.length - previousReleases.length;
  }

  get trendStatus(): React.ComponentProps<typeof ScoreCard>['trendStatus'] {
    if (!this.trend) {
      return undefined;
    }

    return this.trend > 0 ? 'good' : 'bad';
  }

  componentDidUpdate(prevProps: Props) {
    if (prevProps.selection !== this.props.selection) {
      this.remountComponent();
    }
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
        score={<MissingReleasesButtons organization={organization} />}
      />
    );
  }

  renderScore() {
    const {currentReleases, loading} = this.state;

    if (loading || !defined(currentReleases)) {
      return '\u2014';
    }

    return currentReleases.length === API_LIMIT
      ? `${API_LIMIT - 1}+`
      : currentReleases.length;
  }

  renderTrend() {
    const {loading, currentReleases} = this.state;

    if (loading || !defined(this.trend) || currentReleases?.length === API_LIMIT) {
      return null;
    }

    return (
      <React.Fragment>
        {this.trend >= 0 ? (
          <IconArrow direction="up" size="xs" />
        ) : (
          <IconArrow direction="down" size="xs" />
        )}
        {Math.abs(this.trend)}
      </React.Fragment>
    );
  }

  renderBody() {
    const {noReleaseEver} = this.state;

    if (noReleaseEver) {
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

export default ProjectVelocityScoreCard;
