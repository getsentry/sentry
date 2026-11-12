import {Stack} from '@sentry/scraps/layout';

import {EmptyState} from './emptyState';

// Use the real decode exports without loading the Markdown renderer's ESM lexer in SSR.
jest.mock('@sentry/scraps/markdown', () =>
  jest.requireActual('sentry/components/core/markdown/useStreamingAnimation')
);

describe('Seer empty state', () => {
  describe.each([false, true])('suggestions loading=%s', isLoading => {
    it.snapshot.each([320, 476, 800])(
      'beam and suggestions at %s px',
      () => (
        <Stack height="750px" background="primary">
          <EmptyState
            displaySlackAgentReminder
            onSuggestionClick={() => {}}
            suggestions={
              isLoading
                ? {isLoading: true}
                : {
                    isLoading: false,
                    source: 'legacy',
                    suggestions: [
                      {text: 'Which of my open issues are getting worse, not better?'},
                      {
                        text: 'Are there any critical issues without an assigned owner or team?',
                      },
                      {text: 'What are my slowest DB queries?'},
                    ],
                  }
            }
          />
        </Stack>
      ),
      width => ({viewport: width})
    );
  });
});
