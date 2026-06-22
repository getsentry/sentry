import {render, screen} from 'sentry-test/reactTestingLibrary';

import {Count} from 'sentry/components/count';

describe('ConversationsTable columns', () => {
  describe('Messages/Errors display', () => {
    it('renders messages and zero errors without error styling', () => {
      const {container} = render(
        <div>
          <Count value={12} />
          {'/'}
          <Count value={0} />
        </div>
      );

      expect(container.textContent).toBe('12/0');
    });

    it('renders messages with non-zero errors', () => {
      const {container} = render(
        <div>
          <Count value={12} />
          {'/'}
          <span data-test-id="error-count">
            <Count value={3} />
          </span>
        </div>
      );

      expect(container.textContent).toBe('12/3');
      expect(screen.getByTestId('error-count')).toBeInTheDocument();
    });
  });
});
