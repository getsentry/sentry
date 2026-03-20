import {render, screen} from 'sentry-test/reactTestingLibrary';

import {AIContentRenderer} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/aiContentRenderer';

describe('AIContentRenderer', () => {
  it('renders plain text inline', () => {
    render(<AIContentRenderer text="Hello world" inline />);
    expect(screen.getByText('Hello world')).toBeInTheDocument();
  });

  it('renders markdown content inline', () => {
    render(<AIContentRenderer text="**bold text**" inline />);
    expect(screen.getByText('bold text')).toBeInTheDocument();
  });

  it('renders JSON as structured data', () => {
    render(<AIContentRenderer text='{"key": "value"}' />);
    expect(screen.getByText('key')).toBeInTheDocument();
  });

  it('renders fixed JSON with truncated indicator', () => {
    render(<AIContentRenderer text='{"key": "value", "nested": {"inner": "trun' />);
    expect(screen.getByText('Truncated')).toBeInTheDocument();
  });

  it('renders Python dict as JSON', () => {
    render(<AIContentRenderer text="{'name': 'test', 'flag': True}" />);
    expect(screen.getByText('name')).toBeInTheDocument();
  });

  it('renders XML tags with styled wrappers', () => {
    render(<AIContentRenderer text="Before <thinking>inner thought</thinking> After" />);
    expect(screen.getByText('thinking')).toBeInTheDocument();
  });

  it('renders XML tags with styled wrappers when inline', () => {
    render(
      <AIContentRenderer text="Before <thinking>inner thought</thinking> After" inline />
    );
    expect(screen.getByText('thinking')).toBeInTheDocument();
  });

  it('wraps plain text in MultilineText by default', () => {
    render(<AIContentRenderer text="simple text" />);
    expect(screen.getByText('simple text')).toBeInTheDocument();
  });
});
