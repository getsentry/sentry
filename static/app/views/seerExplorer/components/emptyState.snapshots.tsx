import {Stack} from '@sentry/scraps/layout';

import {EmptyState, SlackAgentReminder} from './emptyState';

// Use the real decode exports without loading the Markdown renderer's ESM lexer in SSR.
jest.mock('@sentry/scraps/markdown', () =>
  jest.requireActual('sentry/components/core/markdown/useStreamingAnimation')
);

describe('Seer empty state', () => {
  it.snapshot(
    'draft hides suggestions and Slack reminder',
    () => (
      <Stack height="750px" background="primary">
        <EmptyState
          hasDraft
          onSuggestionClick={() => {}}
          suggestions={{
            isLoading: false,
            source: 'generated',
            suggestions: [
              {text: 'Which issues should I investigate?'},
              {text: 'Where are my slowest queries?'},
              {text: 'What changed in this release?'},
            ],
          }}
        />
        <SlackAgentReminder hasDraft />
      </Stack>
    ),
    {viewport: 476}
  );

  describe.each([false, true])('suggestions loading=%s', isLoading => {
    it.snapshot.each([320, 476, 800])(
      'beam and suggestions at %s px',
      () => (
        <Stack height="750px" background="primary">
          <EmptyState
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
          <SlackAgentReminder />
        </Stack>
      ),
      width => ({viewport: width})
    );
  });
});
