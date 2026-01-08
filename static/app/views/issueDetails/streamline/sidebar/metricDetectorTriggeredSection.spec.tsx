import {SnubaQueryDataSourceFixture} from 'sentry-fixture/detectors';
import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {DataConditionType} from 'sentry/types/workflowEngine/dataConditions';
import type {MetricCondition} from 'sentry/types/workflowEngine/detectors';
import {Dataset, EventTypes} from 'sentry/views/alerts/rules/metric/types';
import {MetricDetectorTriggeredSection} from 'sentry/views/issueDetails/streamline/sidebar/metricDetectorTriggeredSection';

describe('MetricDetectorTriggeredSection', () => {
  const condition: MetricCondition = {
    id: 'cond-1',
    type: DataConditionType.GREATER,
    comparison: 100,
    conditionResult: true,
  };
  const dataSource = SnubaQueryDataSourceFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/members/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/users/',
      body: [],
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/?end=2017-10-17T02%3A41%3A20.000Z&limit=5&project=1&query=issue.type%3Aerror%20event.type%3Aerror%20is%3Aunresolved&sort=freq&start=2019-05-21T17%3A59%3A00.000Z',
      body: [],
    });
  });

  it('renders nothing when event has no occurrence', () => {
    const event = EventFixture({
      occurrence: null,
    });

    const {container} = render(<MetricDetectorTriggeredSection event={event} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders only message when conditions are missing but subtitle exists', () => {
    const event = EventFixture({
      occurrence: {
        id: '1',
        eventId: 'event-1',
        fingerprint: ['fingerprint'],
        issueTitle: 'Test Issue',
        subtitle: 'Subtitle',
        resourceId: 'resource-1',
        evidenceData: {
          conditions: [],
          dataSources: [dataSource],
          value: 150,
        },
        evidenceDisplay: [],
        type: 8001,
        detectionTime: '2024-01-01T00:00:00Z',
      },
    });

    render(<MetricDetectorTriggeredSection event={event} />);

    expect(screen.getByRole('region', {name: 'Message'})).toBeInTheDocument();
    expect(screen.getByText('Subtitle')).toBeInTheDocument();
    expect(
      screen.queryByRole('region', {name: 'Triggered Condition'})
    ).not.toBeInTheDocument();
  });

  it('renders nothing when evidenceData is missing', () => {
    const event = EventFixture({
      occurrence: {
        id: '1',
        eventId: 'event-1',
        fingerprint: ['fingerprint'],
        issueTitle: 'Test Issue',
        subtitle: '',
        resourceId: 'resource-1',
        evidenceData: {},
        evidenceDisplay: [],
        type: 8001,
        detectionTime: '2024-01-01T00:00:00Z',
      },
    });

    const {container} = render(<MetricDetectorTriggeredSection event={event} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders metric detector details with static condition', async () => {
    const event = EventFixture({
      occurrence: {
        id: '1',
        eventId: 'event-1',
        fingerprint: ['fingerprint'],
        issueTitle: 'Test Issue',
        subtitle: 'Subtitle',
        resourceId: 'resource-1',
        evidenceData: {
          conditions: [condition],
          dataSources: [dataSource],
          value: 150,
        },
        evidenceDisplay: [],
        type: 8001,
        detectionTime: '2024-01-01T00:00:00Z',
      },
    });

    render(<MetricDetectorTriggeredSection event={event} />);

    // Check sections exist by aria-label
    expect(await screen.findByRole('region', {name: 'Message'})).toBeInTheDocument();
    expect(screen.getByRole('region', {name: 'Triggered Condition'})).toBeInTheDocument();

    // Check message content
    expect(screen.getByText('Subtitle')).toBeInTheDocument();

    // Check key-value pairs
    expect(screen.getByRole('cell', {name: 'Dataset'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'Errors'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'Aggregate'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'count()'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'Query'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'is:unresolved'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'Interval'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '1 minute'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'Above 100'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'Evaluated Value'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: '150'})).toBeInTheDocument();
  });

  it('renders contributing issues section for errors dataset', async () => {
    const eventDateCreated = '2024-01-01T00:00:00Z';
    // Start date is eventDateCreated minus the timeWindow (60 seconds) minus 1 extra minute
    const startDate = '2023-12-31T23:58:00.000Z';

    const contributingIssuesMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/?end=2017-10-17T02%3A41%3A20.000Z&limit=5&project=1&query=issue.type%3Aerror%20event.type%3Aerror%20is%3Aunresolved&sort=freq&start=${encodeURIComponent(startDate)}`,
      body: [GroupFixture()],
    });

    const event = EventFixture({
      dateCreated: eventDateCreated,
      occurrence: {
        id: '1',
        eventId: 'event-1',
        fingerprint: ['fingerprint'],
        issueTitle: 'Test Issue',
        subtitle: 'Subtitle',
        resourceId: 'resource-1',
        evidenceData: {
          conditions: [condition],
          dataSources: [dataSource],
          value: 150,
        },
        evidenceDisplay: [],
        type: 8001,
        detectionTime: '2024-01-01T00:00:00Z',
      },
    });

    render(<MetricDetectorTriggeredSection event={event} />);

    await waitFor(() => {
      expect(
        screen.getByRole('region', {name: 'Contributing Issues'})
      ).toBeInTheDocument();
    });

    expect(contributingIssuesMock).toHaveBeenCalled();

    await screen.findByRole('link', {name: 'RequestError'});
  });

  it('renders boolean logic error when query contains OR', async () => {
    const dataSourceWithOr = SnubaQueryDataSourceFixture({
      queryObj: {
        id: '1',
        status: 1,
        subscription: '1',
        snubaQuery: {
          aggregate: 'count()',
          dataset: Dataset.ERRORS,
          id: '',
          query: 'browser.name:Chrome OR browser.name:Firefox',
          timeWindow: 60,
          eventTypes: [EventTypes.ERROR],
        },
      },
    });

    const event = EventFixture({
      dateCreated: '2024-01-01T00:00:00Z',
      occurrence: {
        id: '1',
        eventId: 'event-1',
        fingerprint: ['fingerprint'],
        issueTitle: 'Test Issue',
        subtitle: 'Subtitle',
        resourceId: 'resource-1',
        evidenceData: {
          conditions: [condition],
          dataSources: [dataSourceWithOr],
          value: 150,
        },
        evidenceDisplay: [],
        type: 8001,
        detectionTime: '2024-01-01T00:00:00Z',
      },
    });

    render(<MetricDetectorTriggeredSection event={event} />);

    // Check that the boolean logic error alert is shown
    expect(
      await screen.findByText('Contributing issues unavailable for this detector.')
    ).toBeInTheDocument();

    // The View All button should not be present when there's boolean logic
    expect(screen.queryByRole('button', {name: 'View All'})).not.toBeInTheDocument();

    // The Open in Discover button should be present
    expect(screen.getByRole('button', {name: 'Open in Discover'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Open in Discover'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/explore/discover/results/?dataset=errors&end=2017-10-17T02%3A41%3A20.000&field=issue&field=count%28%29&field=count_unique%28user%29&interval=1m&name=Transactions&project=1&query=event.type%3Aerror%20browser.name%3AChrome%20OR%20browser.name%3AFirefox&sort=-count&start=2023-12-31T23%3A58%3A00.000&yAxis=count%28%29'
    );
  });
});
