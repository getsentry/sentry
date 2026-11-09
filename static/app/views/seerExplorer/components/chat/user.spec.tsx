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
  it('collapses the Autofix prompt that starts a run', async () => {
    const block = createBlock({
      message: {role: 'user', content: 'Fix issue ABC-1', metadata: {step: 'single_run'}},
    });
    render(<BlockComponent block={block} blockIndex={0} />);

    expect(screen.getByText('Started Autofix')).toBeInTheDocument();
    expect(screen.getByText('Fix issue ABC-1')).not.toBeVisible();

    await userEvent.click(screen.getByRole('button', {name: 'Started Autofix'}));
    expect(screen.getByText('Fix issue ABC-1')).toBeVisible();
  });

  it('shows a reply to an Autofix run in full', () => {
    const block = createBlock({
      message: {
        role: 'user',
        content: 'Nice, make a code fix',
        metadata: {step: 'single_run'},
      },
    });
    render(<BlockComponent block={block} blockIndex={3} />);

    expect(screen.getByText('Nice, make a code fix')).toBeInTheDocument();
  });

  it('renders content', () => {
    render(<BlockComponent block={createBlock()} blockIndex={0} />);
    expect(screen.getByText('What is this error about?')).toBeInTheDocument();
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
