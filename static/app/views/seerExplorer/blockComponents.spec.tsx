import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import BlockComponent from './blockComponents';
import type {Block} from './types';

describe('BlockComponent', () => {
  const mockOnClick = jest.fn();

  const createUserInputBlock = (overrides?: Partial<Block>): Block => ({
    id: 'user-1',
    message: {
      role: 'user',
      content: 'What is this error about?',
    },
    timestamp: '2024-01-01T00:00:00Z',
    loading: false,
    ...overrides,
  });

  const createResponseBlock = (overrides?: Partial<Block>): Block => ({
    id: 'response-1',
    message: {
      role: 'assistant',
      content: 'This error indicates a null pointer exception.',
    },
    timestamp: '2024-01-01T00:01:00Z',
    loading: false,
    ...overrides,
  });

  beforeEach(() => {
    mockOnClick.mockClear();
    sessionStorage.clear();
  });

  describe('User Input Blocks', () => {
    it('renders user input block with correct content', () => {
      const block = createUserInputBlock();
      render(<BlockComponent block={block} blockIndex={0} onClick={mockOnClick} />);

      expect(screen.getByText('What is this error about?')).toBeInTheDocument();
    });

    it('calls onClick when user input block is clicked', async () => {
      const block = createUserInputBlock();
      render(<BlockComponent block={block} blockIndex={0} onClick={mockOnClick} />);

      await userEvent.click(screen.getByText('What is this error about?'));
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Response Blocks', () => {
    it('renders response block with correct content', () => {
      const block = createResponseBlock();
      render(<BlockComponent block={block} blockIndex={0} onClick={mockOnClick} />);

      expect(
        screen.getByText('This error indicates a null pointer exception.')
      ).toBeInTheDocument();
    });

    it('renders response block with loading state', () => {
      const block = createResponseBlock({
        loading: true,
        message: {
          role: 'assistant',
          content: 'Thinking...',
        },
      });
      render(<BlockComponent block={block} blockIndex={0} onClick={mockOnClick} />);

      expect(screen.getByText('Thinking...')).toBeInTheDocument();
    });

    it('calls onClick when response block is clicked', async () => {
      const block = createResponseBlock();
      const {container} = render(
        <BlockComponent block={block} blockIndex={0} onClick={mockOnClick} />
      );
      const blockElement = container.firstChild;
      await userEvent.click(blockElement as HTMLElement);
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Focus State', () => {
    it('shows reset button when isFocused=true', () => {
      const block = createUserInputBlock();
      render(
        <BlockComponent block={block} blockIndex={0} isFocused onClick={mockOnClick} />
      );

      expect(screen.getByRole('button', {name: '↩'})).toBeInTheDocument();
    });

    it('does not show reset button when isFocused=false', () => {
      const block = createUserInputBlock();
      render(
        <BlockComponent
          block={block}
          blockIndex={0}
          isFocused={false}
          onClick={mockOnClick}
        />
      );

      expect(screen.queryByRole('button', {name: '↩'})).not.toBeInTheDocument();
    });

    it('shows feedback buttons for assistant blocks when isFocused=true', () => {
      const block = createResponseBlock();
      render(
        <BlockComponent block={block} blockIndex={0} isFocused onClick={mockOnClick} />
      );

      expect(
        screen.getByRole('button', {name: 'Seer Explorer Thumbs Up'})
      ).toBeInTheDocument();
      expect(
        screen.getByRole('button', {name: 'Seer Explorer Thumbs Down'})
      ).toBeInTheDocument();
    });

    it('does not show feedback buttons for user blocks', () => {
      const block = createUserInputBlock();
      render(
        <BlockComponent block={block} blockIndex={0} isFocused onClick={mockOnClick} />
      );

      expect(
        screen.queryByRole('button', {name: 'Seer Explorer Thumbs Up'})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Seer Explorer Thumbs Down'})
      ).not.toBeInTheDocument();
    });

    it('disables both thumbs buttons after thumbs up is clicked', async () => {
      const block = createResponseBlock();
      render(
        <BlockComponent block={block} blockIndex={1} isFocused onClick={mockOnClick} />
      );

      const upButton = screen.getByRole('button', {name: 'Seer Explorer Thumbs Up'});
      const downButton = screen.getByRole('button', {name: 'Seer Explorer Thumbs Down'});
      expect(upButton).toBeEnabled();

      await userEvent.click(upButton);

      expect(upButton).toBeDisabled();
      expect(downButton).toBeDisabled();
    });

    it('disables both thumbs buttons after thumbs down is clicked', async () => {
      const block = createResponseBlock();
      render(
        <BlockComponent block={block} blockIndex={2} isFocused onClick={mockOnClick} />
      );

      const upButton = screen.getByRole('button', {name: 'Seer Explorer Thumbs Up'});
      const downButton = screen.getByRole('button', {name: 'Seer Explorer Thumbs Down'});
      expect(downButton).toBeEnabled();

      await userEvent.click(downButton);

      expect(upButton).toBeDisabled();
      expect(downButton).toBeDisabled();
    });
  });

  describe('Markdown Content', () => {
    it('renders markdown content in response blocks', () => {
      const block = createResponseBlock({
        message: {
          role: 'assistant',
          content:
            '# Heading\n\nThis is **bold** text with a [link](https://example.com)',
        },
      });
      render(<BlockComponent block={block} blockIndex={0} onClick={mockOnClick} />);

      expect(screen.getByText('Heading')).toBeInTheDocument();
      expect(screen.getByText('bold')).toBeInTheDocument();
      expect(screen.getByText('link')).toBeInTheDocument();
    });
  });
});
