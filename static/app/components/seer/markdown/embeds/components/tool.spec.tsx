import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SeerMarkdown} from 'sentry/components/seer/markdown';

describe('tool embed', () => {
  it('renders a quiet read from a {% tool %} block', () => {
    const raw = [
      '{% tool %}',
      '{"title": "Read trace waterfall", "status": "success", "reference": {"label": "Trace", "value": "a3805648"}}',
      '{% /tool %}',
    ].join('\n');

    render(<SeerMarkdown raw={raw} />);

    expect(screen.getByText('Read trace waterfall')).toBeInTheDocument();
    expect(screen.getByText('a3805648')).toBeInTheDocument();
    expect(screen.queryByText('Input:')).not.toBeInTheDocument();
  });

  it('renders a query with input pills and an output chip', () => {
    const raw = [
      '{% tool %}',
      '{"title": "Query spans", "status": "success", "variant": "query", "query": "dataset:spans span.description:DSL", "output": {"label": "Trace", "value": "a3805648"}}',
      '{% /tool %}',
    ].join('\n');

    render(<SeerMarkdown raw={raw} />);

    expect(screen.getByText('Query spans')).toBeInTheDocument();
    expect(screen.getByText('Input:')).toBeInTheDocument();
    expect(screen.getByText('dataset')).toBeInTheDocument();
    expect(screen.getByText('span.description')).toBeInTheDocument();
    expect(screen.getByText('Output:')).toBeInTheDocument();
  });

  it('renders nothing for a tool block without a title', () => {
    render(<SeerMarkdown raw={'{% tool %}\n{"status": "success"}\n{% /tool %}'} />);
    expect(screen.queryByText('Input:')).not.toBeInTheDocument();
  });
});
