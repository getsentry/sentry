import styled from '@emotion/styled';
import round from 'lodash/round';

import AsyncComponent from 'app/components/asyncComponent';
import {DateTimeObject, getDiffInMinutes} from 'app/components/charts/utils';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import Placeholder from 'app/components/placeholder';
import {DEFAULT_STATS_PERIOD} from 'app/constants';
import {IconArrow} from 'app/icons';
import {tct} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Project, SessionApiResponse} from 'app/types';
import {defined, percent} from 'app/utils';
import {formatAbbreviatedNumber} from 'app/utils/formatters';
import {getPeriod} from 'app/utils/getPeriod';
import {Color} from 'app/utils/theme';
import {shouldFetchPreviousPeriod} from 'app/views/projectDetail/utils';
import {displayCrashFreePercent, getCrashFreePercent} from 'app/views/releases/utils';

type Props = AsyncComponent['props'] & {
  project: Project;
  organization: Organization;
  hasSessions: boolean | null;
} & DateTimeObject;

type State = AsyncComponent['state'] & {
  currentSessions: SessionApiResponse | null;
  previousSessions: SessionApiResponse | null;
};

class ProjectStabilityColumn extends AsyncComponent<Props, State> {
  shouldRenderBadRequests = true;

  getDefaultState() {
    return {
      ...super.getDefaultState(),
      currentSessions: null,
      previousSessions: null,
    };
  }

  getEndpoints() {
    const {organization, start, end, period, utc, hasSessions, project} = this.props;

    if (!hasSessions) {
      return [];
    }

    const datetime = {start, end, period, utc};
    const commonQuery = {
      environment: [],
      project: project.id,
      field: 'sum(session)',
      groupBy: 'session.status',
      interval: getDiffInMinutes(datetime) > 24 * 60 ? '1d' : '1h',
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
            ...getParams(datetime),
          },
        },
      ],
    ];

    if (shouldFetchPreviousPeriod(datetime)) {
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

  componentDidUpdate(prevProps: Props) {
    const {start, end, period, utc} = this.props;

    if (
      prevProps.start !== start ||
      prevProps.end !== end ||
      prevProps.period !== period ||
      prevProps.utc !== utc
    ) {
      this.remountComponent();
    }
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

  calculateCrashFree(data?: SessionApiResponse | null) {
    if (!data) {
      return undefined;
    }

    const totalSessions = data.groups.reduce(
      (acc, group) => acc + group.totals['sum(session)'],
      0
    );

    const crashedSessions = data.groups.find(
      group => group.by['session.status'] === 'crashed'
    )?.totals['sum(session)'];

    if (totalSessions === 0 || !defined(totalSessions) || !defined(crashedSessions)) {
      return undefined;
    }

    const crashedSessionsPercent = percent(crashedSessions, totalSessions);

    return getCrashFreePercent(100 - crashedSessionsPercent);
  }

  renderLoading() {
    return (
      <div>
        <Placeholder width="300px" height="25px" />
      </div>
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
    const {period} = this.props;
    const {loading} = this.state;

    if (loading || !defined(this.score) || !defined(this.trend)) {
      return null;
    }

    return (
      <SubText color={this.trend >= 0 ? 'green300' : 'red300'}>
        <PaddedIconArrow direction={this.trend >= 0 ? 'up' : 'down'} size="xs" />
        {`${formatAbbreviatedNumber(Math.abs(this.trend))}\u0025`}
        {tct(' compared to last [period]', {period})}
      </SubText>
    );
  }

  renderBody() {
    return (
      <ScoreWrapper>
        {this.renderScore()}
        {this.renderTrend()}
      </ScoreWrapper>
    );
  }
}

export default ProjectStabilityColumn;

const ScoreWrapper = styled('div')`
  display: flex;
  align-items: baseline;
`;

const PaddedIconArrow = styled(IconArrow)`
  margin: 0 ${space(0.5)};
`;

const SubText = styled('div')<{color: Color}>`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme[p.color]};
`;
