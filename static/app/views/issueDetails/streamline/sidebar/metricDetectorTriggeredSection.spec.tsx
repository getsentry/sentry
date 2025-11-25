import {EventFixture} from 'sentry-fixture/event';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {DataConditionType} from 'sentry/types/workflowEngine/dataConditions';
import type {
  MetricCondition,
  SnubaQueryDataSource,
} from 'sentry/types/workflowEngine/detectors';
import {MetricDetectorTriggeredSection} from 'sentry/views/issueDetails/streamline/sidebar/metricDetectorTriggeredSection';

describe('MetricDetectorTriggeredSection', () => {
  it('renders nothing when event has no occurrence', () => {
    const event = EventFixture({
      occurrence: null,
    });

    const {container} = render(<MetricDetectorTriggeredSection event={event} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when evidenceData is missing', () => {
    const event = EventFixture({
      occurrence: {
        id: '1',
        eventId: 'event-1',
        fingerprint: ['fingerprint'],
        issueTitle: 'Test Issue',
        subtitle: 'Subtitle',
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

  it('renders metric detector details with static condition', () => {
    const condition: MetricCondition = {
      id: 'cond-1',
      type: DataConditionType.GREATER,
      comparison: 100,
      conditionResult: true,
    };

    const dataSource: SnubaQueryDataSource = {
      id: 'ds-1',
      type: 'snuba_query_subscription',
      organizationId: 'org-1',
      sourceId: 'source-1',
      queryObj: {
        id: 'query-1',
        status: 0,
        subscription: 'sub-1',
        snubaQuery: {
          id: 'sq-1',
          dataset: 'events',
          eventTypes: ['error'],
          query: 'event.type:error',
          aggregate: 'count()',
          timeWindow: 300,
        },
      },
    };

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
    expect(screen.getByRole('region', {name: 'Message'})).toBeInTheDocument();
    expect(screen.getByRole('region', {name: 'Triggered Condition'})).toBeInTheDocument();

    // Check message content
    expect(screen.getByText('Subtitle')).toBeInTheDocument();

    // Check key-value pairs
    expect(screen.getByText('Aggregate')).toBeInTheDocument();
    expect(screen.getByText('count()')).toBeInTheDocument();
    expect(screen.getByText('Query')).toBeInTheDocument();
    expect(screen.getByText('event.type:error')).toBeInTheDocument();
    expect(screen.getByText('Interval')).toBeInTheDocument();
    expect(screen.getByText('5 minutes')).toBeInTheDocument();
    expect(screen.getByText('Above 100')).toBeInTheDocument();
    expect(screen.getByText('Evaluated Value')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
  });

  it('formats time windows correctly', () => {
    const condition: MetricCondition = {
      id: 'cond-1',
      type: DataConditionType.GREATER,
      comparison: 100,
      conditionResult: true,
    };

    const createEvent = (timeWindow: number) => {
      const dataSource: SnubaQueryDataSource = {
        id: 'ds-1',
        type: 'snuba_query_subscription',
        organizationId: 'org-1',
        sourceId: 'source-1',
        queryObj: {
          id: 'query-1',
          status: 0,
          subscription: 'sub-1',
          snubaQuery: {
            id: 'sq-1',
            dataset: 'events',
            eventTypes: ['error'],
            query: 'test',
            aggregate: 'count()',
            timeWindow,
          },
        },
      };

      return EventFixture({
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
    };

    const {rerender} = render(<MetricDetectorTriggeredSection event={createEvent(30)} />);
    expect(screen.getByText('30 seconds')).toBeInTheDocument();

    rerender(<MetricDetectorTriggeredSection event={createEvent(3600)} />);
    expect(screen.getByText('1 hour')).toBeInTheDocument();

    rerender(<MetricDetectorTriggeredSection event={createEvent(86400)} />);
    expect(screen.getByText('1 day')).toBeInTheDocument();
  });

  it('renders different condition types correctly', () => {
    const createEvent = (type: DataConditionType, comparison: number) => {
      const condition: MetricCondition = {
        id: 'cond-1',
        type,
        comparison,
        conditionResult: true,
      };

      const dataSource: SnubaQueryDataSource = {
        id: 'ds-1',
        type: 'snuba_query_subscription',
        organizationId: 'org-1',
        sourceId: 'source-1',
        queryObj: {
          id: 'query-1',
          status: 0,
          subscription: 'sub-1',
          snubaQuery: {
            id: 'sq-1',
            dataset: 'events',
            eventTypes: ['error'],
            query: 'test',
            aggregate: 'count()',
            timeWindow: 300,
          },
        },
      };

      return EventFixture({
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
    };

    const {rerender} = render(
      <MetricDetectorTriggeredSection
        event={createEvent(DataConditionType.GREATER, 100)}
      />
    );
    expect(screen.getByText('Above 100')).toBeInTheDocument();

    rerender(
      <MetricDetectorTriggeredSection event={createEvent(DataConditionType.LESS, 50)} />
    );
    expect(screen.getByText('Below 50')).toBeInTheDocument();

    rerender(
      <MetricDetectorTriggeredSection event={createEvent(DataConditionType.EQUAL, 75)} />
    );
    expect(screen.getByText('Equal to 75')).toBeInTheDocument();
  });

  it('does not render Query row when query string is empty', () => {
    const condition: MetricCondition = {
      id: 'cond-1',
      type: DataConditionType.GREATER,
      comparison: 100,
      conditionResult: true,
    };

    const dataSource: SnubaQueryDataSource = {
      id: 'ds-1',
      type: 'snuba_query_subscription',
      organizationId: 'org-1',
      sourceId: 'source-1',
      queryObj: {
        id: 'query-1',
        status: 0,
        subscription: 'sub-1',
        snubaQuery: {
          id: 'sq-1',
          dataset: 'events',
          eventTypes: ['error'],
          query: '',
          aggregate: 'count()',
          timeWindow: 300,
        },
      },
    };

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

    expect(screen.queryByText('Query')).not.toBeInTheDocument();
  });

  it('does not render Message section when subtitle is missing', () => {
    const condition: MetricCondition = {
      id: 'cond-1',
      type: DataConditionType.GREATER,
      comparison: 100,
      conditionResult: true,
    };

    const dataSource: SnubaQueryDataSource = {
      id: 'ds-1',
      type: 'snuba_query_subscription',
      organizationId: 'org-1',
      sourceId: 'source-1',
      queryObj: {
        id: 'query-1',
        status: 0,
        subscription: 'sub-1',
        snubaQuery: {
          id: 'sq-1',
          dataset: 'events',
          eventTypes: ['error'],
          query: 'test',
          aggregate: 'count()',
          timeWindow: 300,
        },
      },
    };

    const event = EventFixture({
      occurrence: {
        id: '1',
        eventId: 'event-1',
        fingerprint: ['fingerprint'],
        issueTitle: 'Test Issue',
        subtitle: '',
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

    expect(screen.queryByRole('region', {name: 'Message'})).not.toBeInTheDocument();
    expect(screen.getByRole('region', {name: 'Triggered Condition'})).toBeInTheDocument();
  });
});
