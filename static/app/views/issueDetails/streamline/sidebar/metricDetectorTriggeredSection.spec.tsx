import {SnubaQueryDataSourceFixture} from 'sentry-fixture/detectors';
import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {DataConditionType} from 'sentry/types/workflowEngine/dataConditions';
import type {MetricCondition} from 'sentry/types/workflowEngine/detectors';
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
      url: '/organizations/org-slug/issues/',
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
    const endDate = '2017-10-17T02:41:20.000Z'; // Mocked time in test env

    const contributingIssuesMock = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/',
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

    expect(contributingIssuesMock).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        query: expect.objectContaining({
          query: 'issue.type:error event.type:error is:unresolved',
          start: startDate,
          end: endDate,
        }),
      })
    );

    await screen.findByRole('link', {name: 'RequestError'});
  });
});
