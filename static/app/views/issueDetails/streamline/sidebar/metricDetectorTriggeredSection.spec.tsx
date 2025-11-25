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

    expect(screen.getByText('Metric Monitor Details')).toBeInTheDocument();
    expect(screen.getByText('Triggered Condition')).toBeInTheDocument();
    expect(screen.getByText('gt 100')).toBeInTheDocument();
    expect(screen.getByText('Evaluated Value')).toBeInTheDocument();
    expect(screen.getByText('150')).toBeInTheDocument();
    expect(screen.getByText('Query')).toBeInTheDocument();
    expect(screen.getByText('event.type:error')).toBeInTheDocument();
    expect(screen.getByText('Aggregate')).toBeInTheDocument();
    expect(screen.getByText('count()')).toBeInTheDocument();
    expect(screen.getByText('Time Window')).toBeInTheDocument();
    expect(screen.getByText('5m')).toBeInTheDocument();
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
            query: '',
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
    expect(screen.getByText('30s')).toBeInTheDocument();

    rerender(<MetricDetectorTriggeredSection event={createEvent(3600)} />);
    expect(screen.getByText('1h')).toBeInTheDocument();

    rerender(<MetricDetectorTriggeredSection event={createEvent(86400)} />);
    expect(screen.getByText('1d')).toBeInTheDocument();
  });

  it('renders anomaly detection condition', () => {
    const condition: MetricCondition = {
      id: 'cond-1',
      type: DataConditionType.ANOMALY_DETECTION,
      comparison: {
        thresholdType: 'above',
        sensitivity: 'medium',
        seasonality: 'auto',
      },
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

    expect(
      screen.getByText('above (medium sensitivity, auto seasonality)')
    ).toBeInTheDocument();
  });

  it('handles empty query string', () => {
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

    expect(screen.getByText('None')).toBeInTheDocument();
  });

  it('formats large values with locale formatting', () => {
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
          value: 1234567,
        },
        evidenceDisplay: [],
        type: 8001,
        detectionTime: '2024-01-01T00:00:00Z',
      },
    });

    render(<MetricDetectorTriggeredSection event={event} />);

    expect(screen.getByText('1,234,567')).toBeInTheDocument();
  });
});
