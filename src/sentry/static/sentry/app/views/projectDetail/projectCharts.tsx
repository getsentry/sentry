import React from 'react';
import * as ReactRouter from 'react-router';
import {browserHistory} from 'react-router';
import {withTheme} from 'emotion-theming';
import {Location} from 'history';

import {Client} from 'app/api';
import OptionSelector from 'app/components/charts/optionSelector';
import {
  ChartControls,
  InlineContainer,
  SectionHeading,
  SectionValue,
} from 'app/components/charts/styles';
import {Panel} from 'app/components/panels';
import CHART_PALETTE from 'app/constants/chartPalette';
import {t} from 'app/locale';
import {Organization, SelectValue} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {decodeScalar} from 'app/utils/queryString';
import {Theme} from 'app/utils/theme';
import withApi from 'app/utils/withApi';

import {getTermHelp} from '../performance/data';
import {ChartContainer} from '../performance/styles';

import ProjectBaseEventsChart from './charts/projectBaseEventsChart';
import ProjectStabilityChart from './charts/projectStabilityChart';

enum DisplayModes {
  APDEX = 'apdex',
  FAILURE_RATE = 'failure_rate',
  TPM = 'tpm',
  ERRORS = 'errors',
  TRANSACTIONS = 'transactions',
  STABILITY = 'stability',
}

const DISPLAY_URL_KEY = ['display1', 'display2'];
const DEFAULT_DISPLAY_MODES = [DisplayModes.STABILITY, DisplayModes.APDEX];

type Props = {
  api: Client;
  location: Location;
  organization: Organization;
  router: ReactRouter.InjectedRouter;
  index: number;
  theme: Theme;
};

type State = {
  totalValues: number | null;
};

class ProjectCharts extends React.Component<Props, State> {
  state: State = {
    totalValues: null,
  };

  get otherActiveDisplayModes() {
    const {location, index} = this.props;

    return DISPLAY_URL_KEY.filter((_, idx) => idx !== index).map(urlKey => {
      return (
        decodeScalar(location.query[urlKey]) ??
        DEFAULT_DISPLAY_MODES[DISPLAY_URL_KEY.findIndex(value => value === urlKey)]
      );
    });
  }

  get displayMode() {
    const {location, index} = this.props;
    const displayMode =
      decodeScalar(location.query[DISPLAY_URL_KEY[index]]) ||
      DEFAULT_DISPLAY_MODES[index];

    if (!Object.values(DisplayModes).includes(displayMode as DisplayModes)) {
      return DEFAULT_DISPLAY_MODES[index];
    }

    return displayMode;
  }

  get displayModes(): SelectValue<string>[] {
    const {organization} = this.props;
    const hasPerformance = organization.features.includes('performance-view');
    const hasDiscover = organization.features.includes('discover-basic');
    const noPerformanceTooltip = t(
      'This view is only available with Performance Monitoring.'
    );
    const noDiscoverTooltip = t('This view is only available with Discover.');

    return [
      {
        value: DisplayModes.APDEX,
        label: t('Apdex'),
        disabled:
          this.otherActiveDisplayModes.includes(DisplayModes.APDEX) || !hasPerformance,
        tooltip: hasPerformance
          ? getTermHelp(organization, 'apdex')
          : noPerformanceTooltip,
      },
      {
        value: DisplayModes.FAILURE_RATE,
        label: t('Failure Rate'),
        disabled:
          this.otherActiveDisplayModes.includes(DisplayModes.FAILURE_RATE) ||
          !hasPerformance,
        tooltip: hasPerformance
          ? getTermHelp(organization, 'failureRate')
          : noPerformanceTooltip,
      },
      {
        value: DisplayModes.TPM,
        label: t('Transactions Per Minute'),
        disabled:
          this.otherActiveDisplayModes.includes(DisplayModes.TPM) || !hasPerformance,
        tooltip: hasPerformance ? getTermHelp(organization, 'tpm') : noPerformanceTooltip,
      },
      {
        value: DisplayModes.ERRORS,
        label: t('Daily Errors'),
        disabled:
          this.otherActiveDisplayModes.includes(DisplayModes.ERRORS) || !hasDiscover,
        tooltip: hasDiscover ? undefined : noDiscoverTooltip,
      },
      {
        value: DisplayModes.TRANSACTIONS,
        label: t('Daily Transactions'),
        disabled:
          this.otherActiveDisplayModes.includes(DisplayModes.TRANSACTIONS) ||
          !hasPerformance,
        tooltip: hasPerformance ? undefined : noPerformanceTooltip,
      },
      {
        value: DisplayModes.STABILITY,
        label: t('Stability'),
        disabled: this.otherActiveDisplayModes.includes(DisplayModes.STABILITY),
      },
    ];
  }

  get summaryHeading() {
    switch (this.displayMode) {
      case DisplayModes.ERRORS:
        return t('Total Errors');
      case DisplayModes.STABILITY:
        return t('Total Sessions');
      case DisplayModes.APDEX:
      case DisplayModes.FAILURE_RATE:
      case DisplayModes.TPM:
      case DisplayModes.TRANSACTIONS:
      default:
        return t('Total Transactions');
    }
  }

  handleDisplayModeChange = (value: string) => {
    const {location, index, organization} = this.props;

    trackAnalyticsEvent({
      eventKey: `project_detail.change_chart${index + 1}`,
      eventName: `Project Detail: Change Chart #${index + 1}`,
      organization_id: parseInt(organization.id, 10),
      metric: value,
    });

    browserHistory.push({
      pathname: location.pathname,
      query: {...location.query, [DISPLAY_URL_KEY[index]]: value},
    });
  };

  handleTotalValuesChange = (value: number | null) => {
    if (value !== this.state.totalValues) {
      this.setState({totalValues: value});
    }
  };

  render() {
    const {api, router, organization, theme} = this.props;
    const {totalValues} = this.state;
    const displayMode = this.displayMode;

    return (
      <Panel>
        <ChartContainer>
          {displayMode === DisplayModes.APDEX && (
            <ProjectBaseEventsChart
              title={t('Apdex')}
              help={getTermHelp(organization, 'apdex')}
              query="event.type:transaction"
              yAxis={`apdex(${organization.apdexThreshold})`}
              field={[`apdex(${organization.apdexThreshold})`]}
              api={api}
              router={router}
              organization={organization}
              onTotalValuesChange={this.handleTotalValuesChange}
              colors={[CHART_PALETTE[0][0], theme.purple200]}
            />
          )}
          {displayMode === DisplayModes.FAILURE_RATE && (
            <ProjectBaseEventsChart
              title={t('Failure Rate')}
              help={getTermHelp(organization, 'failureRate')}
              query="event.type:transaction"
              yAxis="failure_rate()"
              field={[`failure_rate()`]}
              api={api}
              router={router}
              organization={organization}
              onTotalValuesChange={this.handleTotalValuesChange}
              colors={[theme.red300, theme.purple200]}
            />
          )}
          {displayMode === DisplayModes.TPM && (
            <ProjectBaseEventsChart
              title={t('Transactions Per Minute')}
              help={getTermHelp(organization, 'tpm')}
              query="event.type:transaction"
              yAxis="tpm()"
              field={[`tpm()`]}
              api={api}
              router={router}
              organization={organization}
              onTotalValuesChange={this.handleTotalValuesChange}
              colors={[theme.yellow300, theme.purple200]}
              disablePrevious
            />
          )}
          {displayMode === DisplayModes.ERRORS && (
            <ProjectBaseEventsChart
              title={t('Daily Errors')}
              query="event.type:error"
              yAxis="count()"
              field={[`count()`]}
              api={api}
              router={router}
              organization={organization}
              onTotalValuesChange={this.handleTotalValuesChange}
              colors={[theme.purple300, theme.purple200]}
              showDaily
            />
          )}
          {displayMode === DisplayModes.TRANSACTIONS && (
            <ProjectBaseEventsChart
              title={t('Daily Transactions')}
              query="event.type:transaction"
              yAxis="count()"
              field={[`count()`]}
              api={api}
              router={router}
              organization={organization}
              onTotalValuesChange={this.handleTotalValuesChange}
              colors={[theme.gray200, theme.purple200]}
              showDaily
            />
          )}
          {displayMode === DisplayModes.STABILITY && (
            <ProjectStabilityChart
              router={router}
              api={api}
              organization={organization}
              onTotalValuesChange={this.handleTotalValuesChange}
            />
          )}
        </ChartContainer>
        <ChartControls>
          <InlineContainer>
            <SectionHeading>{this.summaryHeading}</SectionHeading>
            <SectionValue>
              {typeof totalValues === 'number' ? totalValues.toLocaleString() : '\u2014'}
            </SectionValue>
          </InlineContainer>
          <InlineContainer>
            <OptionSelector
              title={t('Display')}
              selected={displayMode}
              options={this.displayModes}
              onChange={this.handleDisplayModeChange}
            />
          </InlineContainer>
        </ChartControls>
      </Panel>
    );
  }
}

export default withApi(withTheme(ProjectCharts));
