import {Stack} from '@sentry/scraps/layout';

import {EmptyState} from './emptyState';

jest.mock('sentry-images/spot/seer-beam.svg', () => {
  const {readFileSync} = jest.requireActual<typeof import('node:fs')>('node:fs');
  const svg = readFileSync(`${__dirname}/../../../../images/spot/seer-beam.svg`);
  return `data:image/svg+xml;base64,${svg.toString('base64')}`;
});

describe('Seer empty state', () => {
  it.snapshot.each([320, 476, 800])(
    'beam and suggestions at %s px',
    () => (
      <Stack height="750px" background="primary">
        <EmptyState
          onSuggestionClick={() => {}}
          suggestions={{
            isLoading: false,
            source: 'legacy',
            suggestions: [
              {text: 'Which of my open issues are getting worse, not better?'},
              {text: 'Are there any critical issues without an assigned owner or team?'},
              {text: 'What are my slowest DB queries?'},
            ],
          }}
        />
      </Stack>
    ),
    width => ({viewport: width})
  );
});
