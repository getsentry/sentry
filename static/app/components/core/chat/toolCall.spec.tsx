import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ToolCall} from '@sentry/scraps/chat';

describe('ToolCall', () => {
  it('renders a title plus a trailing reference, no output', () => {
    render(
      <ToolCall
        title="Read trace waterfall"
        status="success"
        reference={{label: 'Trace', value: 'a3805648'}}
      />
    );

    expect(screen.getByText('Read trace waterfall')).toBeInTheDocument();
    expect(screen.getByText('a3805648')).toBeInTheDocument();
    expect(screen.queryByText('Output:')).not.toBeInTheDocument();
  });

  it('renders an output chip when output is provided', () => {
    render(
      <ToolCall
        title="Query spans"
        status="success"
        output={{label: 'Trace', value: 'a3805648'}}
      />
    );

    expect(screen.getByText('Query spans')).toBeInTheDocument();
    expect(screen.getByText('Output:')).toBeInTheDocument();
    expect(screen.getByText('a3805648')).toBeInTheDocument();
  });

  it('communicates status via the leading glyph', () => {
    const {rerender} = render(<ToolCall title="Query" status="success" />);
    expect(screen.getByLabelText('Succeeded')).toBeInTheDocument();

    rerender(<ToolCall title="Query" status="failure" />);
    expect(screen.getByLabelText('Failed')).toBeInTheDocument();

    rerender(<ToolCall title="Query" status="loading" />);
    expect(screen.getByLabelText('Running')).toBeInTheDocument();
  });

  it('surfaces notifications', () => {
    render(
      <ToolCall
        title="Query spans"
        status="success"
        notifications={['Truncated to 100 rows']}
      />
    );
    expect(screen.getByText('Truncated to 100 rows')).toBeInTheDocument();
  });
});
