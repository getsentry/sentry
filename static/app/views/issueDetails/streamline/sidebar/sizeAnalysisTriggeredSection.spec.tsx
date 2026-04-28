import type {ComponentProps} from 'react';
import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {IssueCategory, IssueType} from 'sentry/types/group';
import {DataConditionType} from 'sentry/types/workflowEngine/dataConditions';
import type {MetricCondition} from 'sentry/types/workflowEngine/detectors';
import {SizeAnalysisTriggeredSection} from 'sentry/views/issueDetails/streamline/sidebar/sizeAnalysisTriggeredSection';

describe('SizeAnalysisTriggeredSection', () => {
  const condition: MetricCondition = {
    id: 'cond-1',
    type: DataConditionType.GREATER,
    comparison: 1000000,
    conditionResult: 75,
  };

  const defaultGroup = GroupFixture({
    issueType: IssueType.PREPROD_SIZE_ANALYSIS,
    issueCategory: IssueCategory.PREPROD,
  });

  const defaultEvidenceData = {
    detectorId: 8,
    value: 4292608,
    conditions: [condition],
    config: {
      measurement: 'install_size',
      thresholdType: 'absolute_diff',
    },
    headArtifactId: 100,
    baseArtifactId: 99,
    headSizeMetricId: 200,
    baseSizeMetricId: 199,
  };

  const defaultEvent = EventFixture({
    id: 'event-1',
    eventID: 'event-1',
    occurrence: {
      id: '1',
      eventId: 'event-1',
      fingerprint: ['fingerprint'],
      issueTitle: 'Size regression',
      subtitle: 'A preprod static analysis issue was detected',
      resourceId: 'resource-1',
      evidenceData: defaultEvidenceData,
      evidenceDisplay: [],
      type: 11003,
      detectionTime: '2024-01-01T00:00:00Z',
    },
  });

  const defaultProps: ComponentProps<typeof SizeAnalysisTriggeredSection> = {
    group: defaultGroup,
    event: defaultEvent,
  };

  it('renders nothing when event has no occurrence', () => {
    const event = EventFixture({occurrence: null});
    const {container} = render(
      <SizeAnalysisTriggeredSection {...defaultProps} event={event} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders nothing when evidenceData has no config', () => {
    const event = EventFixture({
      occurrence: {
        id: '1',
        eventId: 'event-1',
        fingerprint: ['fingerprint'],
        issueTitle: 'Test',
        subtitle: '',
        resourceId: 'resource-1',
        evidenceData: {},
        evidenceDisplay: [],
        type: 11003,
        detectionTime: '2024-01-01T00:00:00Z',
      },
    });
    const {container} = render(
      <SizeAnalysisTriggeredSection {...defaultProps} event={event} />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it('renders triggered condition details for absolute_diff', () => {
    render(<SizeAnalysisTriggeredSection {...defaultProps} />);

    expect(screen.getByRole('region', {name: 'Triggered Condition'})).toBeInTheDocument();

    expect(screen.getByRole('cell', {name: 'Threshold Type'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'Absolute Diff'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'Measurement'})).toBeInTheDocument();
    expect(
      screen.getByRole('cell', {name: 'Install/Uncompressed Size'})
    ).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'Condition'})).toBeInTheDocument();
    expect(screen.getByRole('cell', {name: 'Evaluated Value'})).toBeInTheDocument();
  });

  it('formats condition as "measurement Diff > value" for diff threshold', () => {
    render(<SizeAnalysisTriggeredSection {...defaultProps} />);

    // absolute_diff with no artifact tag: "Install/Uncompressed Size Diff > 1 MB"
    expect(
      screen.getByRole('cell', {name: 'Install/Uncompressed Size Diff > 1 MB'})
    ).toBeInTheDocument();
  });

  it('shows platform-specific measurement label from artifact type tag', () => {
    const event = EventFixture({
      ...defaultEvent,
      tags: [{key: 'head.artifact_type', value: 'xcarchive'}],
    });

    render(<SizeAnalysisTriggeredSection {...defaultProps} event={event} />);

    expect(screen.getByRole('cell', {name: 'Install Size'})).toBeInTheDocument();
    expect(
      screen.getByRole('cell', {name: 'Install Size Diff > 1 MB'})
    ).toBeInTheDocument();
  });

  it('shows Android measurement label for aab artifact type', () => {
    const event = EventFixture({
      ...defaultEvent,
      tags: [{key: 'head.artifact_type', value: 'aab'}],
    });

    render(<SizeAnalysisTriggeredSection {...defaultProps} event={event} />);

    expect(screen.getByRole('cell', {name: 'Uncompressed Size'})).toBeInTheDocument();
  });

  it('shows both Open Build and Open Comparison for diff threshold types', () => {
    render(<SizeAnalysisTriggeredSection {...defaultProps} />);

    expect(screen.getByRole('button', {name: 'Open Build'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Open Comparison'})).toBeInTheDocument();
  });

  it('shows comparison link with correct path', () => {
    render(<SizeAnalysisTriggeredSection {...defaultProps} />);

    expect(screen.getByRole('button', {name: 'Open Comparison'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/preprod/size/compare/100/99/'
    );
  });

  it('does not show Open Comparison for absolute threshold type', () => {
    const event = EventFixture({
      ...defaultEvent,
      occurrence: {
        ...defaultEvent.occurrence!,
        evidenceData: {
          ...defaultEvidenceData,
          config: {measurement: 'install_size', thresholdType: 'absolute'},
          baseArtifactId: undefined,
        },
      },
    });

    render(<SizeAnalysisTriggeredSection {...defaultProps} event={event} />);

    expect(screen.getByRole('button', {name: 'Open Build'})).toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Open Comparison'})
    ).not.toBeInTheDocument();
  });

  it('renders relative_diff values with percentage', () => {
    const event = EventFixture({
      ...defaultEvent,
      occurrence: {
        ...defaultEvent.occurrence!,
        evidenceData: {
          ...defaultEvidenceData,
          value: 15,
          config: {measurement: 'install_size', thresholdType: 'relative_diff'},
        },
      },
    });

    render(<SizeAnalysisTriggeredSection {...defaultProps} event={event} />);

    expect(screen.getByRole('cell', {name: '+15%'})).toBeInTheDocument();
  });

  it('renders absolute_diff values in MB', () => {
    render(<SizeAnalysisTriggeredSection {...defaultProps} />);

    // 4292608 bytes = +4.29 MB (capped at 2 decimals, + prefix for diff)
    expect(screen.getByRole('cell', {name: '+4.29 MB'})).toBeInTheDocument();
  });

  it('renders query field when present in config', () => {
    const event = EventFixture({
      ...defaultEvent,
      occurrence: {
        ...defaultEvent.occurrence!,
        evidenceData: {
          ...defaultEvidenceData,
          config: {
            ...defaultEvidenceData.config,
            query: 'app_id:com.example.app',
          },
        },
      },
    });

    render(<SizeAnalysisTriggeredSection {...defaultProps} event={event} />);

    expect(screen.getByRole('cell', {name: 'Query'})).toBeInTheDocument();
    expect(
      screen.getByRole('cell', {name: 'app_id:com.example.app'})
    ).toBeInTheDocument();
  });

  it('does not render query field when not present', () => {
    render(<SizeAnalysisTriggeredSection {...defaultProps} />);

    expect(screen.queryByRole('cell', {name: 'Query'})).not.toBeInTheDocument();
  });
});
