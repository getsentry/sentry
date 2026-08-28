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

  it('renders Python dict as JSON', () => {
    render(<AIContentRenderer text="{'name': 'test', 'flag': True}" />);
    expect(screen.getByText('name')).toBeInTheDocument();
  });

  it('renders a json code block as an interactive tree', () => {
    render(<AIContentRenderer text={'```json\n{"alpha": 1, "beta": 2}\n```'} inline />);
    expect(screen.getByText(/alpha/)).toBeInTheDocument();
    expect(screen.getByText(/beta/)).toBeInTheDocument();
  });

  it('falls back to a code block for an invalid json fence', () => {
    render(<AIContentRenderer text={'```json\nnot valid {json\n```'} inline />);
    expect(screen.getByText(/not valid/)).toBeInTheDocument();
  });

  it('renders a python-dict json block as a tree', () => {
    const text = "```json\n{'name': 'test', 'ok': True}\n```";
    render(<AIContentRenderer text={text} inline />);
    expect(screen.getByText(/name/)).toBeInTheDocument();
  });

  it('detects and renders an unescaped JSON blob as a tree', () => {
    const text = `<note>
{"alpha": 1, "beta": 2}
</note>`;
    render(<AIContentRenderer text={text} inline />);
    expect(screen.getByText(/alpha/)).toBeInTheDocument();
    expect(screen.getByText(/beta/)).toBeInTheDocument();
  });

  it('fences raw HTML and JSON wrapped in a custom tag', () => {
    const text = `<note>
{"alpha": 1}
<div>markup</div>
</note>`;
    render(<AIContentRenderer text={text} inline />);
    // Custom tag collapses...
    expect(screen.getByText('<note>')).toBeInTheDocument();
    // ...its JSON content renders as a tree...
    expect(screen.getByText(/alpha/)).toBeInTheDocument();
    // ...and its HTML is fenced as code, not collapsed as a tag.
    expect(screen.queryByText('<div>')).not.toBeInTheDocument();
  });

  it('renders inline XML tags as italic text within the flow', () => {
    render(<AIContentRenderer text="Before <thinking>inner thought</thinking> After" />);
    expect(screen.getByText(/thinking: inner thought/)).toBeInTheDocument();
  });

  it('renders block XML tags with styled wrappers', () => {
    render(<AIContentRenderer text={'Text\n<thinking>inner thought</thinking>'} />);
    expect(screen.getByText('<thinking>')).toBeInTheDocument();
  });

  it('does not collapse known HTML tags into a tag label', () => {
    render(<AIContentRenderer text={'Text\n<div>markup</div>'} inline />);
    expect(screen.queryByText('<div>')).not.toBeInTheDocument();
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
    expect(screen.getByText('<bug_report>')).toBeInTheDocument();
    expect(screen.getByText('<location>')).toBeInTheDocument();
    expect(screen.getByText('<description>')).toBeInTheDocument();
    expect(screen.getByText('file.ts')).toBeInTheDocument();
    expect(screen.getByText('a bug')).toBeInTheDocument();
  });

  it('wraps plain text in MultilineText by default', () => {
    render(<AIContentRenderer text="simple text" />);
    expect(screen.getByText('simple text')).toBeInTheDocument();
  });

  it('renders collapsible XML tags with tag name label', () => {
    const text = '<thinking>\nsome thought\n</thinking>';
    render(<AIContentRenderer text={text} inline />);

    expect(screen.getByText('<thinking>')).toBeInTheDocument();
  });

  it('renders nested collapsible XML with hierarchy', () => {
    const text = '<outer>\n<inner>nested content</inner>\n</outer>';
    render(<AIContentRenderer text={text} inline />);

    expect(screen.getByText('<outer>')).toBeInTheDocument();
    expect(screen.getByText('<inner>')).toBeInTheDocument();
    expect(screen.getByText('nested content')).toBeInTheDocument();
  });

  it('falls back to raw text when markdown renders nothing (empty code fence)', () => {
    render(<AIContentRenderer text="```" inline />);
    expect(screen.getByText('```')).toBeInTheDocument();
  });

  it('falls back to raw text for non-inline empty markdown (span Output "Pretty")', () => {
    render(<AIContentRenderer text="```" />);
    expect(screen.getByText('```')).toBeInTheDocument();
  });

  it('still renders a code fence that has real content', async () => {
    render(<AIContentRenderer text={'```\nconst x = 1;\n```'} inline />);
    expect(await screen.findByText(/const x = 1;/)).toBeInTheDocument();
  });

  it('collapses generic XML tags by default', () => {
    const text = '<thinking>\nhidden thought\n</thinking>';
    render(<AIContentRenderer text={text} inline />);

    expect(screen.getByText('<thinking>').closest('details')).not.toHaveAttribute('open');
  });

  it.each(['user_message', 'user-message', 'userMessage', 'user_msg', 'user_input'])(
    'expands the %s tag by default',
    tagName => {
      const text = `<${tagName}>\nhello there\n</${tagName}>`;
      render(<AIContentRenderer text={text} inline />);

      expect(screen.getByText(`<${tagName}>`).closest('details')).toHaveAttribute('open');
    }
  );

  it('renders Seer-style embed tags as plaintext via default Markdown', () => {
    const embed = '{% issue %}{"id":"PROJ-1"}{% /issue %}';
    const text = `Before ${embed} after`;
    const {container} = render(<AIContentRenderer text={text} inline />);

    expect(container).toHaveTextContent(text);
  });
});
