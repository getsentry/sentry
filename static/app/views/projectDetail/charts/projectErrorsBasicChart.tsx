import {browserHistory} from 'react-router';
import type {BarSeriesOption} from 'echarts';
import {Location} from 'history';

import BaseChart from 'sentry/components/charts/baseChart';
import {HeaderTitleLegend} from 'sentry/components/charts/styles';
import TransitionChart from 'sentry/components/charts/transitionChart';
import TransparentLoadingMask from 'sentry/components/charts/transparentLoadingMask';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import {DEFAULT_STATS_PERIOD} from 'sentry/constants';
import {t} from 'sentry/locale';
import {Organization, Project} from 'sentry/types';
import getDynamicText from 'sentry/utils/getDynamicText';

export const ERRORS_BASIC_CHART_PERIODS = ['1h', '24h', '7d', '14d', '30d'];

type Props = DeprecatedAsyncComponent['props'] & {
  location: Location;
  onTotalValuesChange: (value: number | null) => void;
  organization: Organization;
  projectId?: string;
};

type State = DeprecatedAsyncComponent['state'] & {
  projects: Project[] | null;
};

class ProjectErrorsBasicChart extends DeprecatedAsyncComponent<Props, State> {
  getDefaultState() {
    return {
      ...super.getDefaultState(),
      projects: null,
    };
  }

  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
    const {organization, projectId} = this.props;

    if (!projectId) {
      return [];
    }

    return [
      [
        'projects',
        `/organizations/${organization.slug}/projects/`,
        {
          query: {
            statsPeriod: this.getStatsPeriod(),
            query: `id:${projectId}`,
          },
        },
      ],
    ];
  }

  componentDidMount() {
    super.componentDidMount();
    const {location} = this.props;
    if (!ERRORS_BASIC_CHART_PERIODS.includes(location.query.statsPeriod)) {
      browserHistory.replace({
        pathname: location.pathname,
        query: {
          ...location.query,
          statsPeriod: this.getStatsPeriod(),
          start: undefined,
          end: undefined,
        },
      });
    }
  }

  onLoadAllEndpointsSuccess() {
    this.props.onTotalValuesChange(
      this.state.projects?.[0]?.stats?.reduce((acc, [, value]) => acc + value, 0) ?? null
    );
  }

  getStatsPeriod() {
    const {location} = this.props;
    const statsPeriod = location.query.statsPeriod;

    if (ERRORS_BASIC_CHART_PERIODS.includes(statsPeriod)) {
      return statsPeriod;
    }

    return DEFAULT_STATS_PERIOD;
  }

  getSeries(): BarSeriesOption[] {
    const {projects} = this.state;

    return [
      {
        cursor: 'normal' as const,
        name: t('Errors'),
        type: 'bar',
        data:
          projects?.[0]?.stats?.map(([timestamp, value]) => [timestamp * 1000, value]) ??
          [],
      },
    ];
  }

  renderLoading() {
    return this.renderBody();
  }

  renderBody() {
    const {loading, reloading} = this.state;

    return getDynamicText({
      value: (
        <TransitionChart loading={loading} reloading={reloading}>
          <TransparentLoadingMask visible={reloading} />

          <HeaderTitleLegend>{t('Daily Errors')}</HeaderTitleLegend>

          <BaseChart
            series={this.getSeries()}
            isGroupedByDate
            showTimeInTooltip
            colors={theme => [theme.purple300, theme.purple200]}
            grid={{left: '10px', right: '10px', top: '40px', bottom: '0px'}}
          />
        </TransitionChart>
      ),
      fixed: t('Number of Errors Chart'),
    });
  }
}

export default ProjectErrorsBasicChart;
