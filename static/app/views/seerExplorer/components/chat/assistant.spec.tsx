import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {BlockComponent} from 'sentry/views/seerExplorer/components/chat';
import type {Block} from 'sentry/views/seerExplorer/types';

function createBlock(overrides?: Partial<Block>): Block {
  return {
    id: 'response-1',
    message: {
      role: 'assistant',
      content: 'This error indicates a null pointer exception.',
    },
    timestamp: '2024-01-01T00:01:00Z',
    loading: false,
    ...overrides,
  };
}

describe('AssistantBlock', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('renders content', () => {
    render(<BlockComponent block={createBlock()} blockIndex={0} />);
    expect(
      screen.getByText('This error indicates a null pointer exception.')
    ).toBeInTheDocument();
  });

  it('renders loading placeholder', () => {
    const block = createBlock({
      loading: true,
      message: {role: 'assistant', content: 'Thinking...'},
    });
    render(<BlockComponent block={block} blockIndex={0} />);
    expect(screen.getByText('Thinking...')).toBeInTheDocument();
  });

  it('renders markdown content', () => {
    const block = createBlock({
      message: {
        role: 'assistant',
        content: '# Heading\n\nThis is **bold** text with a [link](https://example.com)',
      },
    });
    render(<BlockComponent block={block} blockIndex={0} />);

    expect(screen.getByText('Heading')).toBeInTheDocument();
    expect(screen.getByText('bold')).toBeInTheDocument();
    expect(screen.getByText('link')).toBeInTheDocument();
  });

  it('calls onClick when clicked', async () => {
    const onClick = jest.fn();
    const {container} = render(
      <BlockComponent block={createBlock()} blockIndex={0} onClick={onClick} />
    );
    await userEvent.click(container.firstChild as HTMLElement);
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  describe('action bar', () => {
    it('shows feedback and copy buttons on hover', async () => {
      const {container} = render(
        <BlockComponent block={createBlock()} blockIndex={0} runId={123} />
      );

      await userEvent.hover(container.firstChild as HTMLElement);

      expect(
        screen.getByRole('button', {name: 'I like this response'})
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: "I don't like this response"})
      ).toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Copy to clipboard'})).toBeInTheDocument();
    });

    it('disables both thumbs after thumbs up is clicked', async () => {
      const {container} = render(
        <BlockComponent block={createBlock()} blockIndex={1} runId={123} />
      );

      await userEvent.hover(container.firstChild as HTMLElement);

      const upButton = screen.getByRole('button', {name: 'I like this response'});
      const downButton = screen.getByRole('button', {name: "I don't like this response"});

      await userEvent.click(upButton);

      expect(upButton).toBeDisabled();
      expect(downButton).toBeDisabled();
    });

    it('disables both thumbs after thumbs down is clicked', async () => {
      const {container} = render(
        <BlockComponent block={createBlock()} blockIndex={2} runId={123} />
      );

      await userEvent.hover(container.firstChild as HTMLElement);

      const upButton = screen.getByRole('button', {name: 'I like this response'});
      const downButton = screen.getByRole('button', {name: "I don't like this response"});

      await userEvent.click(downButton);

      expect(upButton).toBeDisabled();
      expect(downButton).toBeDisabled();
    });

    it('does not disable thumbs without runId', async () => {
      const {container} = render(
        <BlockComponent block={createBlock()} blockIndex={1} runId={undefined} />
      );

      await userEvent.hover(container.firstChild as HTMLElement);

      const upButton = screen.getByRole('button', {name: 'I like this response'});
      const downButton = screen.getByRole('button', {name: "I don't like this response"});

      await userEvent.click(upButton);

      expect(upButton).toBeEnabled();
      expect(downButton).toBeEnabled();
    });

    it('hides action bar when interactionPending', async () => {
      const {container} = render(
        <BlockComponent
          block={createBlock()}
          blockIndex={0}
          runId={123}
          interactionPending
        />
      );

      await userEvent.hover(container.firstChild as HTMLElement);

      expect(
        screen.queryByRole('button', {name: 'I like this response'})
      ).not.toBeInTheDocument();
    });

    it('hides action bar in readOnly mode', async () => {
      const {container} = render(
        <BlockComponent block={createBlock()} blockIndex={0} runId={123} readOnly />
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

  it('renders same-origin links as router links', () => {
    const block = createBlock({
      message: {
        role: 'assistant',
        content: `Check [this issue](${window.location.origin}/issues/ABC-123/)`,
      },
    });
    render(<BlockComponent block={block} blockIndex={0} />);

    const link = screen.getByRole('link', {name: 'this issue'});
    expect(link).not.toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('href', '/issues/ABC-123/');
  });

  it('renders external links with target _blank', () => {
    const block = createBlock({
      message: {
        role: 'assistant',
        content: 'See [docs](https://docs.sentry.io/getting-started/)',
      },
    });
    render(<BlockComponent block={block} blockIndex={0} />);

    const link = screen.getByRole('link', {name: 'docs'});
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('renders nothing for empty content', () => {
    const block = createBlock({
      message: {role: 'assistant', content: ''},
    });
    const {container} = render(<BlockComponent block={block} blockIndex={0} />);
    expect(container).toHaveTextContent('');
  });

  describe('streaming', () => {
    const streamingOrg = OrganizationFixture({
      features: ['seer-explorer-stream'],
    });

    it('renders streaming markdown for loading block with content', () => {
      const block = createBlock({
        loading: true,
        message: {role: 'assistant', content: 'Partial streamed content...'},
      });
      render(<BlockComponent block={block} blockIndex={0} />, {
        organization: streamingOrg,
      });
      expect(screen.getByText('Partial streamed content...')).toBeInTheDocument();
    });

    it('renders spinner only for loading block without content', () => {
      const block = createBlock({
        loading: true,
        message: {role: 'assistant', content: ''},
      });
      const {container} = render(<BlockComponent block={block} blockIndex={0} />, {
        organization: streamingOrg,
      });
      expect(container).toHaveTextContent('');
    });

    it('renders static markdown for completed block', () => {
      const block = createBlock({
        loading: false,
        message: {role: 'assistant', content: 'Final content.'},
      });
      render(<BlockComponent block={block} blockIndex={0} />, {
        organization: streamingOrg,
      });
      expect(screen.getByText('Final content.')).toBeInTheDocument();
    });
  });
});
