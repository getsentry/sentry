import {Fragment, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {LineChartSeries} from 'sentry/components/charts/lineChart';
import {LineChart} from 'sentry/components/charts/lineChart';
import {Tag} from 'sentry/components/core/badge/tag';
import {Button} from 'sentry/components/core/button';
import {Input} from 'sentry/components/core/input';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';
import useApi from 'sentry/utils/useApi';

import PageHeader from 'admin/components/pageHeader';

const SECOND_TO_MILLISECOND = 1000;
const MILLISECOND_TO_DAY = SECOND_TO_MILLISECOND * 60 * 60 * 24;

type IssueOwnerMatch = {rule: string; source: string};
type Forecast = {data: number[]; date_added: number};
type IssueDetailsResponse = Group & {forecast: Forecast};

function IssueOwnerDebbuging() {
  const api = useApi();
  const [organizationSlug, setOrganizationSlug] = useState('');

  const [projectSlug, setProjectSlug] = useState('');
  const [stacktracePath, setStacktracePath] = useState('');
  const [ruleMatches, setRuleMatches] = useState<IssueOwnerMatch[]>([]);
  const handleSubmit = async (event: any) => {
    event.preventDefault();
    if (!projectSlug || !stacktracePath) {
      addErrorMessage(
        'Requires the organization slug, the project slug and the stacktrace path.'
      );
      return;
    }

    const data = await api.requestPromise(
      `/organizations/${organizationSlug}/debugging/issue-owners/`,
      {
        method: 'GET',
        query: {projectSlug, stacktracePath},
      }
    );
    setRuleMatches(data);
  };

  return (
    <Fragment>
      <form onSubmit={handleSubmit}>
        <p>
          Find the matching Issue Owner rules for a given stacktrace filepath for a
          project.
        </p>
        <SearchContainer>
          <div>Organization Slug:</div>
          <Input
            type="text"
            name="organizaton-slug"
            onChange={e => setOrganizationSlug(e.target.value)}
            value={organizationSlug}
            minLength={1}
            placeholder="sentry"
          />
          <div>Project Slug:</div>
          <Input
            type="text"
            name="project-slug"
            onChange={e => setProjectSlug(e.target.value)}
            value={projectSlug}
            minLength={1}
            placeholder="sentry"
          />

          <div>Stacktrace Path:</div>
          <Input
            type="text"
            name="stacktrace-path"
            onChange={e => setStacktracePath(e.target.value)}
            value={stacktracePath}
            minLength={1}
            placeholder="/src/sentry/integrations/github/webhook.py"
          />
          <Button priority="primary" type="submit">
            Submit
          </Button>
        </SearchContainer>
      </form>
      <PanelTable headers={['Type', 'Rule']} isEmpty={!ruleMatches.length}>
        {ruleMatches.map(({source, rule}, index) => (
          <Fragment key={rule}>
            <div>{source}</div>
            <div>
              <span>{rule}</span>
              {!index && <StyledTag variant="success">Assigned Rule</StyledTag>}
            </div>
          </Fragment>
        ))}
      </PanelTable>
    </Fragment>
  );
}

function getForecastForTimestamp(
  forecast: Forecast,
  timestamp: number,
  forecastDate: Date
): number {
  // Returns the corresponding forecast for a given timestamp, if it exists.
  const date = new Date(new Date(timestamp).toDateString()); // Convert timestamp to a date with no time
  const diff = date.getTime() - forecastDate.getTime();
  const index = diff / MILLISECOND_TO_DAY;
  if (index < 0) {
    return -1;
  }
  return forecast.data[index]!;
}

function getHourlyForecasts(
  forecast: Forecast,
  timestamps: number[]
): [number[], number[]] {
  // Returns the timestamps with a corresponding forecast and the forecasts.
  const dateForecastAdded = new Date(
    new Date(forecast.date_added * SECOND_TO_MILLISECOND).toDateString() // Convert timestamp to a date with no time
  );
  const forecasts: number[] = [];
  const timestampsWithForecast: number[] = [];

  for (const timestamp of timestamps) {
    const timestampForecast = getForecastForTimestamp(
      forecast,
      timestamp,
      dateForecastAdded
    );
    if (timestampForecast !== -1) {
      forecasts.push(timestampForecast);
      timestampsWithForecast.push(timestamp);
    }
  }
  return [timestampsWithForecast, forecasts];
}

function IssueEscalatingDebugging() {
  const api = useApi();
  const [organizationSlug, setOrganizationSlug] = useState('');
  const [groupId, setGroupId] = useState('');
  const [hourlySeries, setHourlySeries] = useState<LineChartSeries[]>([]);

  const handleSubmit = async (event: any) => {
    event.preventDefault();
    if (!groupId) {
      addErrorMessage('Requires the group id.');
      return;
    }

    const expand = ['forecast'];
    const data: IssueDetailsResponse = await api.requestPromise(
      `/organizations/${organizationSlug}/issues/${groupId}/`,
      {
        method: 'GET',
        query: {expand},
      }
    );

    const forecast: Forecast = data.forecast;
    const hourlyCount: Array<[number, number]> = data.stats['24h']!;

    if (forecast && forecast.data.length > 0) {
      const timestamps = hourlyCount.map(
        (countData: number[], _: any) => countData[0]! * SECOND_TO_MILLISECOND
      );
      const hourlyCountSeriesData = hourlyCount.map((count, i) => ({
        value: count[1],
        name: timestamps[i]!,
      }));

      const [timestampsWithForecast, hourlyForecasts] = getHourlyForecasts(
        forecast,
        timestamps
      );
      const hourlyForecastSeriesData = hourlyForecasts.map((hourlyForecast, i) => ({
        value: hourlyForecast,
        name: timestampsWithForecast[i]!,
      }));
      setHourlySeries([
        {seriesName: 'Hourly Event Count', data: hourlyCountSeriesData},
        {seriesName: 'Hourly Event Forecast', data: hourlyForecastSeriesData},
      ]);
    }
  };

  return (
    <Fragment>
      <form onSubmit={handleSubmit}>
        <p>
          Graph an issue's escalating forecast and hourly event volume for the past 24
          hours.
        </p>
        <SearchContainer>
          <div>Organization Slug:</div>
          <Input
            type="text"
            name="organizaton-slug"
            onChange={e => setOrganizationSlug(e.target.value)}
            value={organizationSlug}
            minLength={1}
            placeholder="sentry"
          />
          <div>Group Id:</div>
          <Input
            type="text"
            name="group-id"
            onChange={e => setGroupId(e.target.value)}
            value={groupId}
            minLength={1}
            placeholder="1"
          />
          <Button priority="primary" type="submit">
            Submit
          </Button>
        </SearchContainer>
      </form>
      <LineChart
        height={300}
        series={hourlySeries}
        grid={{left: space(4), right: space(4)}}
        showTimeInTooltip
        xAxis={{
          show: hourlySeries.length > 0,
        }}
        legend={{
          show: true,
          orient: 'horizontal',
          data:
            hourlySeries.length > 0
              ? ['Hourly Event Count', 'Hourly Event Forecast']
              : [],
        }}
      />
    </Fragment>
  );
}

function DebuggingTools() {
  return (
    <div>
      <PageHeader title="Debug Tools" />
      <h3>Issue Owners:</h3>
      <IssueOwnerDebbuging />
      <h3>Escalating Issues:</h3>
      <IssueEscalatingDebugging />
    </div>
  );
}

export const SearchContainer = styled('div')`
  display: grid;
  grid-template-rows: 1fr;
  grid-template-columns: repeat(2, 1fr 2fr) 1fr 5fr 1fr;
  gap: ${space(3)};
  padding: ${space(1.5)};
  align-items: center;
`;

const StyledTag = styled(Tag)`
  padding: 0 ${space(4)};
`;
export default DebuggingTools;
