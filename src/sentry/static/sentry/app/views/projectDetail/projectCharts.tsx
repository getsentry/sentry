import React from 'react';
import * as ReactRouter from 'react-router';
import {browserHistory} from 'react-router';
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
import {t} from 'app/locale';
import {Organization, SelectValue} from 'app/types';
import {decodeScalar} from 'app/utils/queryString';
import withApi from 'app/utils/withApi';

import {getTermHelp} from '../performance/data';
import {ChartContainer} from '../performance/styles';

import ProjectBaseEventsChart from './charts/projectBaseEventsChart';

enum DisplayModes {
  APDEX = 'apdex',
}

const DEFAULT_DISPLAY_MODE = DisplayModes.APDEX;

type Props = {
  api: Client;
  location: Location;
  organization: Organization;
  router: ReactRouter.InjectedRouter;
};

type State = {
  totalValues: number | null;
};

class ProjectCharts extends React.Component<Props, State> {
  state: State = {
    totalValues: null,
  };

  get displayMode() {
    const {location} = this.props;
    const displayMode = decodeScalar(location.query.display) || DEFAULT_DISPLAY_MODE;

    if (!Object.values(DisplayModes).includes(displayMode as DisplayModes)) {
      return DEFAULT_DISPLAY_MODE;
    }

    return displayMode;
  }

  get displayModes(): SelectValue<string>[] {
    const {organization} = this.props;
    const hasPerformance = organization.features.includes('performance-view');
    return [
      {
        value: DisplayModes.APDEX,
        label: t('Apdex'),
        disabled: !hasPerformance,
        tooltip: hasPerformance
          ? getTermHelp(organization, 'apdex')
          : t('This view is only available with Performance Monitoring.'),
      },
    ];
  }

  get summaryHeading() {
    switch (this.displayMode) {
      case DisplayModes.APDEX:
      default:
        return t('Total Transactions');
    }
  }

  handleDisplayModeChange = (value: string) => {
    const {location} = this.props;

    browserHistory.push({
      pathname: location.pathname,
      query: {...location.query, display: value},
    });
  };

  handleTotalValuesChange = (value: number | null) => {
    this.setState({totalValues: value});
  };

  render() {
    const {api, router, organization} = this.props;
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

export default withApi(ProjectCharts);
