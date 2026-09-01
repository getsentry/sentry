import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SeerMarkdown, SeerEmbedResolverProvider} from 'sentry/components/seer/markdown';

import {parseEmbedReference} from './reference';

const CHART = {
  title: 'Error volume',
  visualization: 'line',
  x_axis: 'time',
  y_axis_unit: 'number',
  series: [{label: 'Errors', data: [{x: '2026-07-30T12:00:00Z', y: 12}]}],
};

describe('parseEmbedReference', () => {
  it('splits a reference into block, type and key', () => {
    expect(parseEmbedReference('blk-9.chart.a3f')).toEqual({
      blockId: 'blk-9',
      name: 'chart',
      key: 'a3f',
    });
  });

  it('keeps dots in the block id', () => {
    // Block ids are opaque here, so only the last two segments are structural.
    expect(parseEmbedReference('run.1.block.2.chart.a3f')?.blockId).toBe('run.1.block.2');
  });

  it.each([
    ['an unregistered type', 'blk-9.nonesuch.a3f'],
    [
      'a structured-only embed, which owns its key as a single value',
      'b.agentWriteApproval.k',
    ],
    ['a missing key', 'blk-9.chart.'],
    ['a missing block', '.chart.a3f'],
    ['too few segments', 'chart.a3f'],
    ['no segments', 'a3f'],
  ])('rejects %s', (_label, ref) => {
    expect(parseEmbedReference(ref)).toBeNull();
  });
});

describe('referenced embeds', () => {
  function renderWithLane(raw: string, lane: Record<string, unknown> = {a3f: CHART}) {
    render(
      <SeerEmbedResolverProvider
        resolver={(blockId, name, key) =>
          blockId === 'blk-9' && name === 'chart' ? lane[key] : undefined
        }
      >
        <SeerMarkdown raw={raw} />
      </SeerEmbedResolverProvider>
    );
  }

  it('renders a payload the markdown only addresses', () => {
    renderWithLane('{% chart ref="blk-9.chart.a3f" /%}');
    expect(screen.getByText('Error volume')).toBeInTheDocument();
  });

  it('resolves two references in one document to different payloads', () => {
    renderWithLane(
      '{% chart ref="blk-9.chart.a3f" /%}\n\n{% chart ref="blk-9.chart.b7c" /%}',
      {a3f: CHART, b7c: {...CHART, title: 'Latency'}}
    );
    expect(screen.getByText('Error volume')).toBeInTheDocument();
    expect(screen.getByText('Latency')).toBeInTheDocument();
  });

  it('renders nothing when the key names no entry', () => {
    renderWithLane('{% chart ref="blk-9.chart.missing" /%}');
    expect(screen.queryByText('Error volume')).not.toBeInTheDocument();
  });

  it('renders nothing when the block names no lane', () => {
    renderWithLane('{% chart ref="other-block.chart.a3f" /%}');
    expect(screen.queryByText('Error volume')).not.toBeInTheDocument();
  });

  it('renders nothing when the tag disagrees with the reference type', () => {
    // Rather than handing the payload to a schema it was not produced for.
    renderWithLane('{% issue ref="blk-9.chart.a3f" /%}');
    expect(screen.queryByText('Error volume')).not.toBeInTheDocument();
  });

  it('renders nothing when no resolver is in scope', () => {
    render(<SeerMarkdown raw='{% chart ref="blk-9.chart.a3f" /%}' />);
    expect(screen.queryByText('Error volume')).not.toBeInTheDocument();
  });
});

describe('resolution without a reference', () => {
  it('still reads an inline body', () => {
    render(<SeerMarkdown raw={`{% chart %}${JSON.stringify(CHART)}{% /chart %}`} />);
    expect(screen.getByText('Error volume')).toBeInTheDocument();
  });

  it('still reads structuredContent for a bodyless tag', () => {
    render(
      <SeerMarkdown raw="{% chart %}{% /chart %}" structuredContent={{chart: CHART}} />
    );
    expect(screen.getByText('Error volume')).toBeInTheDocument();
  });

  it('prefers an inline body over structuredContent', () => {
    render(
      <SeerMarkdown
        raw={`{% chart %}${JSON.stringify(CHART)}{% /chart %}`}
        structuredContent={{chart: {...CHART, title: 'From the bus'}}}
      />
    );
    expect(screen.getByText('Error volume')).toBeInTheDocument();
  });
});
