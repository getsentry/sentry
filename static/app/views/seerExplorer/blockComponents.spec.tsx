import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import {textWithMarkupMatcher} from 'sentry-test/utils';

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
  });

  describe('User Input Blocks', () => {
    it('renders user input block with correct content', () => {
      const block = createUserInputBlock();
      render(<BlockComponent block={block} onClick={mockOnClick} />);

      expect(screen.getByText('What is this error about?')).toBeInTheDocument();
    });

    it('calls onClick when user input block is clicked', async () => {
      const block = createUserInputBlock();
      render(<BlockComponent block={block} onClick={mockOnClick} />);

      await userEvent.click(screen.getByText('What is this error about?'));
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Response Blocks', () => {
    it('renders response block with correct content', () => {
      const block = createResponseBlock();
      render(<BlockComponent block={block} onClick={mockOnClick} />);

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
      render(<BlockComponent block={block} onClick={mockOnClick} />);

      expect(screen.getByText('Thinking...')).toBeInTheDocument();
    });

    it('calls onClick when response block is clicked', async () => {
      const block = createResponseBlock();
      render(<BlockComponent block={block} onClick={mockOnClick} />);

      await userEvent.click(
        screen.getByText('This error indicates a null pointer exception.')
      );
      expect(mockOnClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('Focus State', () => {
    it('shows delete hint when isFocused=true', () => {
      const block = createUserInputBlock();
      render(<BlockComponent block={block} isFocused onClick={mockOnClick} />);

      expect(
        screen.getByText(textWithMarkupMatcher('Rethink from here ⌫'))
      ).toBeInTheDocument();
    });

    it('does not show delete hint when isFocused=false', () => {
      const block = createUserInputBlock();
      render(<BlockComponent block={block} isFocused={false} onClick={mockOnClick} />);

      expect(
        screen.queryByText(textWithMarkupMatcher('Rethink from here ⌫'))
      ).not.toBeInTheDocument();
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
      render(<BlockComponent block={block} onClick={mockOnClick} />);

      expect(screen.getByText('Heading')).toBeInTheDocument();
      expect(screen.getByText('bold')).toBeInTheDocument();
      expect(screen.getByText('link')).toBeInTheDocument();
    });
  });
});
