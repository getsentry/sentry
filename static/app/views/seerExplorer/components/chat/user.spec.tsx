import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {BlockComponent} from 'sentry/views/seerExplorer/components/chat';
import type {Block} from 'sentry/views/seerExplorer/types';

function createBlock(overrides?: Partial<Block>): Block {
  return {
    id: 'user-1',
    message: {
      role: 'user',
      content: 'What is this error about?',
    },
    timestamp: '2024-01-01T00:00:00Z',
    loading: false,
    ...overrides,
  };
}

describe('UserBlock', () => {
  it('renders content', () => {
    render(<BlockComponent block={createBlock()} blockIndex={0} />);
    expect(screen.getByText('What is this error about?')).toBeInTheDocument();
  });

  it('formats markdown and actor mentions without losing literal text', () => {
    render(
      <BlockComponent
        block={createBlock({
          message: {
            role: 'user',
            content:
              '**Investigate** `TypeError` [details](https://example.com)\n\n' +
              '*literal\n\n' +
              '{% example %}{"value":"keep this"}{% /example %}\n\n' +
              'Ask {% user %}{"id":"1","type":"user","name":"Jane Doe"}{% /user %}',
          },
        })}
        blockIndex={0}
      />
    );

    expect(screen.getByText('Investigate').tagName).toBe('STRONG');
    expect(screen.getByText('TypeError').tagName).toBe('CODE');
    expect(screen.getByRole('link', {name: 'details'})).toHaveAttribute(
      'href',
      'https://example.com'
    );
    expect(screen.getByText('*literal')).toBeInTheDocument();
    expect(
      screen.getByText('{% example %}{"value":"keep this"}{% /example %}')
    ).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.queryByText(/\{% user %\}/)).not.toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const onClick = jest.fn();
    render(<BlockComponent block={createBlock()} blockIndex={0} onClick={onClick} />);

    await userEvent.click(screen.getByText('What is this error about?'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('does not show feedback or copy buttons on hover', async () => {
    const {container} = render(
      <BlockComponent block={createBlock()} blockIndex={0} runId={123} />
    );

    await userEvent.hover(container.firstChild as HTMLElement);

    expect(
      screen.queryByRole('button', {name: 'I like this response'})
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole('button', {name: 'Copy to clipboard'})
    ).not.toBeInTheDocument();
  });
});
