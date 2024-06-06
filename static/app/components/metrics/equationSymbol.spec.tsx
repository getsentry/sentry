import {render, screen} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

import {
  EquationSymbol,
  getEquationSymbol,
} from 'sentry/components/metrics/equationSymbol';

describe('getEquationSymbol', () => {
  it('should return the correct symbol', () => {
    expect(getEquationSymbol(0)).toBe('ƒ1');
    expect(getEquationSymbol(1)).toBe('ƒ2');
  });
});

describe('EquationSymbol', () => {
  it('renders', () => {
    render(<EquationSymbol equationId={0} />);
    expect(screen.getByText(textWithMarkupMatcher('ƒ1'))).toBeInTheDocument();

    render(<EquationSymbol equationId={5} />);
    expect(screen.getByText(textWithMarkupMatcher('ƒ6'))).toBeInTheDocument();
  });
});
