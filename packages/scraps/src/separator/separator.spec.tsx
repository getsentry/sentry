import {Separator} from '@sentry/scraps/separator';

import {render, screen} from '../../test/env';

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
    expect(() =>
      render(
        // @ts-expect-error children are not allowed
        <Separator orientation="horizontal">Hello</Separator>
      )
    ).toThrow();
  });
});
