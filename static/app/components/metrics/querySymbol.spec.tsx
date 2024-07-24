import {render, screen} from 'sentry-test/reactTestingLibrary';

import {getQuerySymbol, QuerySymbol} from 'sentry/components/metrics/querySymbol';

describe('getQuerySymbol', () => {
  it('should return the correct symbol', () => {
    expect(getQuerySymbol(0)).toBe('A');
    expect(getQuerySymbol(1)).toBe('B');
    expect(getQuerySymbol(25)).toBe('Z');
    expect(getQuerySymbol(26)).toBe('AA');
    expect(getQuerySymbol(27)).toBe('AB');
    expect(getQuerySymbol(52)).toBe('BA');
    expect(getQuerySymbol(53)).toBe('BB');
    expect(getQuerySymbol(77)).toBe('BZ');
    expect(getQuerySymbol(78)).toBe('CA');
    expect(getQuerySymbol(702)).toBe('AAA');
  });
});

describe('QuerySymbol', () => {
  it('renders', () => {
    render(<QuerySymbol queryId={0} />);
    expect(screen.getByText('A')).toBeInTheDocument();

    render(<QuerySymbol queryId={27} />);
    expect(screen.getByText('AB')).toBeInTheDocument();
  });

  it('does not render for negative query ids', () => {
    const {container} = render(<QuerySymbol queryId={-1} />);
    expect(container).toBeEmptyDOMElement();
  });
});
