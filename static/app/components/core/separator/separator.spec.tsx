import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Separator} from '@sentry/scraps/separator';

describe('Separator', () => {
  it('should render a horizontal Separator', () => {
    render(<Separator orientation="horizontal" />);
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('should render a vertical Separator', () => {
    render(<Separator orientation="vertical" />);
    expect(screen.getByRole('separator')).toBeInTheDocument();
  });

  it('does not allow children', () => {
    // @ts-expect-error children are not allowed
    expect(() => render(<Separator orientation="horizontal">Hello</Separator>)).toThrow();
  });
});
