import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {AnnotationItem} from 'sentry/components/charts/annotations/types';

import {AnnotationMarkerTooltip} from './annotationMarkerTooltip';

const START = Date.UTC(2024, 0, 12, 15, 0);
const MINUTE = 60_000;

function change(overrides: Partial<AnnotationItem> = {}): AnnotationItem {
  return {
    id: 'change',
    kind: 'timeseriesAnnotation',
    start: START,
    title: 'Delayed event ingestion',
    annotationType: 'sentry_outage',
    severity: 'high',
    ...overrides,
  };
}

describe('AnnotationMarkerTooltip', () => {
  it('shows the type, description, severity, and range of a change', () => {
    render(
      <AnnotationMarkerTooltip
        items={[change({end: START + 90 * MINUTE})]}
        timezone="UTC"
      />
    );

    expect(screen.getByText('Sentry outage')).toBeInTheDocument();
    expect(screen.getByText('Delayed event ingestion')).toBeInTheDocument();
    expect(screen.getByText('High')).toBeInTheDocument();
    expect(
      screen.getByText('Jan 12, 2024 3:00 PM - 4:30 PM UTC (1 hour 30 minutes)')
    ).toBeInTheDocument();
  });

  it('shows when an ongoing change started', () => {
    render(<AnnotationMarkerTooltip items={[change({end: 'ongoing'})]} timezone="UTC" />);

    expect(screen.getByText('Jan 12, 2024 3:00 PM UTC - Ongoing')).toBeInTheDocument();
  });
});
