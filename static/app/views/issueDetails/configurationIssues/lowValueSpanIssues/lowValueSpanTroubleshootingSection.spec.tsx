import {EventFixture} from 'sentry-fixture/event';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {LowValueSpanTroubleshootingSection} from './lowValueSpanTroubleshootingSection';
import type {LowValueSpanEvidenceData} from './types';

const baseEvidenceData: LowValueSpanEvidenceData = {
  op: 'function',
  description: 'compute_checksum',
  count: 1234,
  extrapolatedCount: 60_000,
  avgDurationMs: 0.4,
  spanOrigin: 'auto',
};

function makeEvent(overrides: Partial<LowValueSpanEvidenceData> = {}) {
  return EventFixture({
    occurrence: {
      evidenceData: {...baseEvidenceData, ...overrides},
      type: 13002,
    },
  });
}

describe('LowValueSpanTroubleshootingSection', () => {
  it('renders automatic instrumentation guidance for auto spans', () => {
    render(
      <LowValueSpanTroubleshootingSection
        event={makeEvent()}
        project={ProjectFixture({platform: 'javascript-nextjs'})}
      />
    );

    expect(screen.getByText('ignoreSpans')).toBeInTheDocument();
    expect(screen.queryByText('function - compute_checksum')).not.toBeInTheDocument();
    expect(screen.queryByText('1. Find the custom span')).not.toBeInTheDocument();
    expect(screen.queryByText('2. Remove or replace the span')).not.toBeInTheDocument();
  });

  it('renders manual instrumentation guidance only for manual spans', () => {
    render(
      <LowValueSpanTroubleshootingSection
        event={makeEvent({spanOrigin: 'manual'})}
        project={ProjectFixture({platform: 'javascript-nextjs'})}
      />
    );

    expect(screen.getByText('1. Find the custom span')).toBeInTheDocument();
    expect(screen.getByText('2. Remove or replace the span')).toBeInTheDocument();
    expect(screen.getByText(/delete the custom span line/)).toBeInTheDocument();
    expect(screen.getAllByText('function - compute_checksum').length).toBeGreaterThan(0);
    expect(screen.queryByText('ignoreSpans')).not.toBeInTheDocument();
    expect(screen.queryByText('before_send_transaction')).not.toBeInTheDocument();
  });

  it('links to the platform-redirect custom instrumentation docs for manual spans', () => {
    render(
      <LowValueSpanTroubleshootingSection
        event={makeEvent({spanOrigin: 'manual'})}
        project={ProjectFixture()}
      />
    );

    expect(
      screen.getByRole('link', {name: 'Read the custom instrumentation docs'})
    ).toHaveAttribute(
      'href',
      'https://docs.sentry.io/platform-redirect/?next=/tracing/instrumentation/custom-instrumentation/'
    );
  });

  it('uses the platform-redirect filtering docs as a fallback', () => {
    render(
      <LowValueSpanTroubleshootingSection
        event={makeEvent()}
        project={ProjectFixture({platform: 'ruby-rails'})}
      />
    );

    expect(
      screen.getByRole('link', {name: 'Read the SDK filtering docs'})
    ).toHaveAttribute(
      'href',
      'https://docs.sentry.io/platform-redirect/?next=/configuration/filtering/'
    );
  });

  it('recommends JavaScript span filtering', () => {
    render(
      <LowValueSpanTroubleshootingSection
        event={makeEvent()}
        project={ProjectFixture({platform: 'javascript-nextjs'})}
      />
    );

    expect(screen.getByText('ignoreSpans')).toBeInTheDocument();
    expect(screen.getByText(/op: "function"/)).toBeInTheDocument();
    expect(screen.getByText(/name: "compute_checksum"/)).toBeInTheDocument();
  });

  it('recommends before_send_transaction for Python project platforms', () => {
    render(
      <LowValueSpanTroubleshootingSection
        event={makeEvent()}
        project={ProjectFixture({platform: 'python-django'})}
      />
    );

    expect(screen.getByText('before_send_transaction')).toBeInTheDocument();
    expect(screen.getAllByText(/event\["spans"\]/).length).toBeGreaterThan(0);
    expect(screen.getByText(/span.get\("op"\) == "function"/)).toBeInTheDocument();
  });

  it('uses a JavaScript project platform for JavaScript snippets', () => {
    render(
      <LowValueSpanTroubleshootingSection
        event={makeEvent()}
        project={ProjectFixture({platform: 'javascript-nextjs'})}
      />
    );

    expect(screen.getByText('ignoreSpans')).toBeInTheDocument();
    expect(screen.getByText(/op: "function"/)).toBeInTheDocument();
    expect(screen.queryByText(/Add an exact-match span filter/)).not.toBeInTheDocument();
  });

  it('uses a Python project platform for Python snippets', () => {
    render(
      <LowValueSpanTroubleshootingSection
        event={makeEvent()}
        project={ProjectFixture({platform: 'python-django'})}
      />
    );

    expect(screen.getByText('before_send_transaction')).toBeInTheDocument();
    expect(screen.getByText(/span.get\("op"\) == "function"/)).toBeInTheDocument();
    expect(screen.queryByText(/Add an exact-match span filter/)).not.toBeInTheDocument();
  });

  it('renders generic guidance when the project platform is unavailable', () => {
    render(
      <LowValueSpanTroubleshootingSection
        event={makeEvent()}
        project={ProjectFixture()}
      />
    );

    expect(screen.getByText(/Add an exact-match span filter/)).toBeInTheDocument();
    expect(screen.queryByText('ignoreSpans')).not.toBeInTheDocument();
    expect(screen.queryByText('before_send_transaction')).not.toBeInTheDocument();
  });

  it('treats missing span origin as automatic instrumentation', () => {
    render(
      <LowValueSpanTroubleshootingSection
        event={makeEvent({spanOrigin: null})}
        project={ProjectFixture({platform: 'javascript-nextjs'})}
      />
    );

    expect(screen.getByText('ignoreSpans')).toBeInTheDocument();
    expect(screen.queryByText('1. Find the custom span')).not.toBeInTheDocument();
  });

  it('emits op-only ignoreSpans with an over-match warning when description is null', () => {
    render(
      <LowValueSpanTroubleshootingSection
        event={makeEvent({description: null})}
        project={ProjectFixture({platform: 'javascript-nextjs'})}
      />
    );

    expect(screen.getByText(/op: "function"/)).toBeInTheDocument();
    expect(screen.queryByText(/name:/)).not.toBeInTheDocument();
    expect(
      screen.getByText(/will also drop other spans with this op/)
    ).toBeInTheDocument();
  });

  it('uses `is None` in the Python snippet when description is null', () => {
    render(
      <LowValueSpanTroubleshootingSection
        event={makeEvent({description: null})}
        project={ProjectFixture({platform: 'python-django'})}
      />
    );

    expect(screen.getByText(/span.get\("op"\) == "function"/)).toBeInTheDocument();
    expect(screen.getByText(/span.get\("description"\) is None/)).toBeInTheDocument();
  });
});
