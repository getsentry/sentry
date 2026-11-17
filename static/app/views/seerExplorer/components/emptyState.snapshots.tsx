import {useRef, type ComponentProps} from 'react';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';

import {Stack} from '@sentry/scraps/layout';

import type {ChatSuggestionsState} from 'sentry/views/seerExplorer/hooks/useChatSuggestions';

import {EmptyState, SlackAgentReminder} from './emptyState';
import {InputSection} from './inputSection';

// Use the real decode exports without loading the Markdown renderer's ESM lexer in SSR.
jest.mock('@sentry/scraps/markdown', () =>
  jest.requireActual('sentry/components/core/markdown/useStreamingAnimation')
);

const VIEWPORTS = [320, 476, 800, 1024];
const suggestions = {
  isLoading: false,
  source: 'legacy',
  suggestions: [
    {text: 'Which of my open issues are getting worse, not better?'},
    {text: 'Are there any critical issues without an assigned owner or team?'},
    {text: 'What are my slowest DB queries?'},
  ],
} satisfies ChatSuggestionsState;

function EmptyStateFrame(props: ComponentProps<typeof EmptyState>) {
  const composerRef = useRef<HTMLDivElement>(null);
  return (
    <QueryClientProvider client={new QueryClient()}>
      <Stack height="750px" background="primary" overflow="hidden">
        <Stack flex="1" minHeight="0" overflow="auto">
          <EmptyState {...props} composerRef={composerRef} onSuggestionClick={() => {}} />
        </Stack>
        {!props.isLoading && !props.isError && (
          <SlackAgentReminder hasDraft={props.hasDraft} suggestions={props.suggestions} />
        )}
        <InputSection
          enabled={!props.isLoading && !props.isError}
          composerRef={composerRef}
          inputValue={{
            text: props.hasDraft ? 'Help me investigate this issue' : '',
            mentions: [],
          }}
          canSendMessage={props.hasDraft}
          onInputChange={() => {}}
          onInputClick={() => {}}
          onInterrupt={() => {}}
          onKeyDown={() => {}}
          onSend={() => {}}
          repoPRStates={{}}
        />
      </Stack>
    </QueryClientProvider>
  );
}

describe('Seer empty state', () => {
  it.snapshot.each(VIEWPORTS)(
    'draft hides suggestions and Slack reminder at %s px',
    () => <EmptyStateFrame hasDraft suggestions={suggestions} />,
    width => ({viewport: width})
  );

  describe.each([false, true])('suggestions loading=%s', isLoading => {
    it.snapshot.each(VIEWPORTS)(
      'beam and suggestions at %s px',
      () => <EmptyStateFrame suggestions={isLoading ? {isLoading: true} : suggestions} />,
      width => ({viewport: width})
    );
  });

  it.snapshot.each([320, 1024])(
    'without suggestions at %s px',
    () => <EmptyStateFrame />,
    width => ({viewport: width})
  );
});
