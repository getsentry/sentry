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

  it('renders inline XML tags as italic text within the flow', () => {
    render(<AIContentRenderer text="Before <thinking>inner thought</thinking> After" />);
    expect(screen.getByText(/thinking: inner thought/)).toBeInTheDocument();
  });

  it('renders block XML tags with styled wrappers', () => {
    render(<AIContentRenderer text={'Text\n<thinking>inner thought</thinking>'} />);
    expect(screen.getByText('thinking')).toBeInTheDocument();
  });

  it('renders inline XML tags as italic text when inline', () => {
    render(
      <AIContentRenderer text="Before <thinking>inner thought</thinking> After" inline />
    );
    expect(screen.getByText(/thinking: inner thought/)).toBeInTheDocument();
  });

  it('renders nested XML tags recursively', () => {
    const text =
      '<bug_report>\n<location>file.ts</location>\n<description>a bug</description>\n</bug_report>';
    render(<AIContentRenderer text={text} />);
    expect(screen.getByText('bug_report')).toBeInTheDocument();
    expect(screen.getByText('location')).toBeInTheDocument();
    expect(screen.getByText('description')).toBeInTheDocument();
    expect(screen.getByText('file.ts')).toBeInTheDocument();
    expect(screen.getByText('a bug')).toBeInTheDocument();
  });

  it('wraps plain text in MultilineText by default', () => {
    render(<AIContentRenderer text="simple text" />);
    expect(screen.getByText('simple text')).toBeInTheDocument();
  });
});
