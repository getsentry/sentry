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
});
