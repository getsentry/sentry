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
    expect(screen.queryByTestId('pr-feedback-notice')).not.toBeInTheDocument();
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

  it('renders PR feedback as a feedback list, not a user message', () => {
    render(
      <BlockComponent
        block={createBlock({
          message: {
            role: 'user',
            content: 'rename it',
            metadata: {
              step: 'pr_iteration',
              iteration_index: '1',
              feedback: JSON.stringify([
                {
                  text: 'rename it',
                  timestamp: '2026-11-12T10:00:00Z',
                  source: {
                    type: 'github-pr-comment',
                    comment: {
                      id: 1,
                      body: 'rename it',
                      html_url: 'https://github.com/org/repo/pull/12#issuecomment-1',
                      user: {login: 'octo'},
                    },
                  },
                },
              ]),
            },
          },
        })}
        blockIndex={0}
      />
    );

    expect(screen.getByTestId('pr-feedback-notice')).toHaveTextContent('rename it');
    expect(screen.getAllByText('rename it')).toHaveLength(1);
    expect(screen.queryByTestId('feedback-processed')).not.toBeInTheDocument();
    expect(screen.queryByRole('time')).not.toBeInTheDocument();
  });
});
