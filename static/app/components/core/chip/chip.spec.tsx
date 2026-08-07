import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Chip} from '@sentry/scraps/chip';

describe('Chip', () => {
  it('renders property, operator, and value for the query variant', () => {
    render(<Chip property="browser" operator="is" value="Chrome" />);
    expect(screen.getByText('browser')).toBeInTheDocument();
    expect(screen.getByText('is')).toBeInTheDocument();
    expect(screen.getByText('Chrome')).toBeInTheDocument();
  });

  it('defaults the operator to "is"', () => {
    render(<Chip property="browser" value="Chrome" />);
    expect(screen.getByText('is')).toBeInTheDocument();
  });

  it('renders only the value for the value variant', () => {
    render(<Chip variant="value" value="Chrome" />);
    expect(screen.getByText('Chrome')).toBeInTheDocument();
    expect(screen.queryByText('browser')).not.toBeInTheDocument();
    expect(screen.queryByText('is')).not.toBeInTheDocument();
  });

  it('renders property/operator/value for the readonly-query variant', () => {
    render(<Chip variant="readonly-query" property="browser" value="Chrome" />);
    expect(screen.getByText('browser')).toBeInTheDocument();
    expect(screen.getByText('is')).toBeInTheDocument();
    expect(screen.getByText('Chrome')).toBeInTheDocument();
  });

  it('is not dismissable by default', () => {
    render(<Chip property="browser" value="Chrome" />);
    expect(screen.queryByRole('button', {name: 'Remove'})).not.toBeInTheDocument();
  });

  it('renders a dismiss button and fires onDismiss', async () => {
    const onDismiss = jest.fn();
    render(<Chip property="browser" value="Chrome" onDismiss={onDismiss} />);
    await userEvent.click(screen.getByRole('button', {name: 'Remove'}));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
