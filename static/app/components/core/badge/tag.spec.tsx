import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Tag} from 'sentry/components/core/badge/tag';
import {IconFire} from 'sentry/icons';

describe('Tag', () => {
  it('basic', () => {
    render(<Tag>Text</Tag>);
    expect(screen.getByText('Text')).toBeInTheDocument();
  });

  it('with icon', () => {
    render(
      <Tag icon={<IconFire data-test-id="icon-fire" />} type="error">
        Error
      </Tag>
    );
    expect(screen.getByText('Error')).toBeInTheDocument();
    expect(screen.getByTestId('icon-fire')).toBeInTheDocument();
  });

  it('with tooltip', async () => {
    render(
      <Tag type="highlight" tooltipText="lorem ipsum">
        Tooltip
      </Tag>
    );
    expect(screen.getByText('Tooltip')).toBeInTheDocument();
    expect(screen.queryByText('lorem ipsum')).not.toBeInTheDocument();
    await userEvent.hover(screen.getByText('Tooltip'));
    expect(await screen.findByText('lorem ipsum')).toBeInTheDocument();
  });

  it('with dismiss', async () => {
    const mockCallback = jest.fn();

    render(
      <Tag type="highlight" onDismiss={mockCallback}>
        Dismissable
      </Tag>
    );
    expect(screen.getByText('Dismissable')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Dismiss'})).toBeInTheDocument();

    expect(mockCallback).toHaveBeenCalledTimes(0);
    await userEvent.click(screen.getByRole('button', {name: 'Dismiss'}));
    expect(mockCallback).toHaveBeenCalledTimes(1);
  });

  it('with internal link', () => {
    const to = '/organizations/sentry/issues/';
    render(
      <Tag type="highlight" to={to}>
        Internal link
      </Tag>
    );
    expect(screen.getByText('Internal link')).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Internal link'})).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'Internal link'})).toHaveAttribute('href', to);
  });
});
