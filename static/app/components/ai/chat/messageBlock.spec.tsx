import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  AssistantMessageBlock,
  UserMessageBlock,
} from 'sentry/components/ai/chat/messageBlock';

describe('messageBlock', () => {
  describe('UserMessageBlock', () => {
    it('renders its content', () => {
      render(<UserMessageBlock>hello there</UserMessageBlock>);
      expect(screen.getByText('hello there')).toBeInTheDocument();
    });
  });

  describe('AssistantMessageBlock', () => {
    it('renders its content', () => {
      render(<AssistantMessageBlock>assistant reply</AssistantMessageBlock>);
      expect(screen.getByText('assistant reply')).toBeInTheDocument();
    });
  });
});
