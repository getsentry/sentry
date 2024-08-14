import {render, screen} from 'sentry-test/reactTestingLibrary';

import {getQuerySymbol, QuerySymbol} from 'sentry/components/metrics/querySymbol';

describe('getQuerySymbol', () => {
  it('should return the correct symbol', () => {
    expect(getQuerySymbol(0)).toBe('a');
    expect(getQuerySymbol(1)).toBe('b');
    expect(getQuerySymbol(25)).toBe('z');
    expect(getQuerySymbol(26)).toBe('aa');
    expect(getQuerySymbol(27)).toBe('ab');
    expect(getQuerySymbol(52)).toBe('ba');
    expect(getQuerySymbol(53)).toBe('bb');
    expect(getQuerySymbol(77)).toBe('bz');
    expect(getQuerySymbol(78)).toBe('ca');
    expect(getQuerySymbol(702)).toBe('aaa');
  });
});

describe('QuerySymbol', () => {
  it('renders', () => {
    render(<QuerySymbol queryId={0} />);
    expect(screen.getByText('a')).toBeInTheDocument();

    render(<QuerySymbol queryId={27} />);
    expect(screen.getByText('ab')).toBeInTheDocument();
  });

  it('does not render for negative query ids', () => {
    const {container} = render(<QuerySymbol queryId={-1} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders everything in uppercase', () => {
    render(<QuerySymbol queryId={0} />, {
      organization: {features: ['metrics-new-inputs']},
    });
    expect(screen.getByText('A')).toBeInTheDocument();

    render(<QuerySymbol queryId={27} />, {
      organization: {features: ['metrics-new-inputs']},
    });
    expect(screen.getByText('AB')).toBeInTheDocument();
  });
});
