import {render, screen} from 'sentry-test/reactTestingLibrary';

import {QueryTokens} from '@sentry/scraps/chat';

describe('QueryTokens', () => {
  it('renders a pill per filter with a readable operator', () => {
    render(<QueryTokens query="dataset:spans span.op:agent.query" />);

    expect(screen.getByText('dataset')).toBeInTheDocument();
    expect(screen.getByText('spans')).toBeInTheDocument();
    expect(screen.getByText('span.op')).toBeInTheDocument();
    expect(screen.getByText('agent.query')).toBeInTheDocument();
    expect(screen.getAllByText('is')).toHaveLength(2);
  });

  it('renders an inline label when provided', () => {
    render(<QueryTokens query="dataset:spans" label="Input:" />);
    expect(screen.getByText('Input:')).toBeInTheDocument();
  });

  it('renders "is not" for negated filters', () => {
    render(<QueryTokens query="!dataset:spans" />);
    expect(screen.getByText('is not')).toBeInTheDocument();
  });

  it('renders nothing when there are no filters', () => {
    const {container} = render(<QueryTokens query="just free text" />);
    expect(container).toBeEmptyDOMElement();
  });
});
