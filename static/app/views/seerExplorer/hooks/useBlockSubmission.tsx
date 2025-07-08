import {useCallback} from 'react';

import type {Block} from 'sentry/views/seerExplorer/types';

interface UseBlockSubmissionProps {
  setBlocks: React.Dispatch<React.SetStateAction<Block[]>>;
  setInputValue: React.Dispatch<React.SetStateAction<string>>;
  textareaRef: React.RefObject<HTMLTextAreaElement | null>;
}

export function useBlockSubmission({
  setBlocks,
  setInputValue,
  textareaRef,
}: UseBlockSubmissionProps) {
  const handleSubmit = useCallback(
    (inputValue: string) => {
      if (!inputValue.trim()) return;

      const question = inputValue.trim();

      // Add user input block
      const userBlock: Block = {
        id: Date.now().toString(),
        type: 'user-input',
        content: question,
        timestamp: new Date(),
      };

      // Add loading response block
      const responseBlockId = (Date.now() + 1).toString();
      const loadingResponseBlock: Block = {
        id: responseBlockId,
        type: 'response',
        content: 'Thinking...',
        timestamp: new Date(),
        loading: true,
      };

      setBlocks(prev => [...prev, userBlock, loadingResponseBlock]);
      setInputValue('');

      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }

      // Simulate AI response after 2 seconds
      setTimeout(() => {
        setBlocks(prev =>
          prev.map(block =>
            block.id === responseBlockId
              ? {
                  ...block,
                  content: `You asked: "${question}". This is where the AI response would go.`,
                  loading: false,
                }
              : block
          )
        );
      }, 2000);
    },
    [setBlocks, setInputValue, textareaRef]
  );

  return {handleSubmit};
}
