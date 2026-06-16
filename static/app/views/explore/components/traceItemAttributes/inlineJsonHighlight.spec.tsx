import {render, screen} from 'sentry-test/reactTestingLibrary';

import {InlineJsonHighlight} from './inlineJsonHighlight';

describe('InlineJsonHighlight', () => {
  it('renders plain text without highlighting', () => {
    render(<InlineJsonHighlight value="hello world" />);
    expect(screen.getByText('hello world')).toBeInTheDocument();
  });

  it('renders text with embedded JSON and highlights JSON portion', () => {
    render(<InlineJsonHighlight value='prefix {"key": "value"} suffix' />);
    const wrapper = screen.getByText(/prefix/);
    expect(wrapper).toHaveTextContent('prefix {"key": "value"} suffix');
    expect(wrapper.querySelector('code.language-json')).toBeInTheDocument();
  });

  it('renders invalid braces as plain text', () => {
    render(<InlineJsonHighlight value="not {json" />);
    expect(screen.getByText('not {json')).toBeInTheDocument();
  });

  it('renders template-style braces as plain text', () => {
    render(<InlineJsonHighlight value="hello {name} world" />);
    expect(screen.getByText('hello {name} world')).toBeInTheDocument();
  });

  it('uses code element for JSON segments', () => {
    render(<InlineJsonHighlight value='data: {"a": 1}' />);
    const wrapper = screen.getByText(/data/);
    expect(wrapper.querySelector('code.language-json')).toBeInTheDocument();
  });
});
