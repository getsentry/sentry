import {render, screen} from 'sentry-test/reactTestingLibrary';

import type {TraceResult} from 'sentry/views/explore/hooks/useTraces';

import {TraceEmbedStory} from './traceEmbedStory';

jest.mock('sentry/components/seer/markdown', () => ({
  SeerMarkdown: ({raw}: {raw: string}) => <div aria-label="Rendered markdown">{raw}</div>,
}));

function createTraceResult(trace: Partial<TraceResult>): TraceResult {
  return {
    breakdowns: [],
    duration: 300,
    end: Date.UTC(2026, 7, 28, 16, 37, 12),
    matchingSpans: 1,
    name: 'Example trace',
    numErrors: 0,
    numOccurrences: 1,
    numSpans: 2,
    project: 'example-project',
    rootDuration: 300,
    slices: 10,
    start: Date.UTC(2026, 7, 28, 16, 37, 11),
    trace: '11111111111111111111111111111111',
    ...trace,
  };
}

describe('TraceEmbedStory', () => {
  it('uses a recent trace with spans for the example', async () => {
    const emptyTrace = createTraceResult({
      numSpans: 0,
      trace: '00000000000000000000000000000000',
    });
    const trace = createTraceResult({
      trace: '1234567890abcdef1234567890abcdef',
    });
    const traceRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/traces/',
      body: {data: [emptyTrace, trace], meta: {}},
      match: [
        MockApiClient.matchQuery({
          breakdownSlices: 40,
          dataset: 'spans',
          per_page: 25,
          sort: '-timestamp',
          statsPeriod: '7d',
        }),
      ],
    });

    render(<TraceEmbedStory />);

    const renderedMarkdown = await screen.findByLabelText('Rendered markdown');
    expect(renderedMarkdown).toHaveTextContent(trace.trace);
    expect(renderedMarkdown).toHaveTextContent(new Date(trace.end).toISOString());
    expect(renderedMarkdown).not.toHaveTextContent(emptyTrace.trace);
    expect(traceRequest).toHaveBeenCalled();
  });
});
