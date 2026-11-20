import {useState} from 'react';

import {Flex, Stack} from '@sentry/scraps/layout';

import * as Storybook from 'sentry/stories';

import {EXAMPLE_CITATIONS} from './__fixtures__/examples';
import {CitationChip, CitationDetail} from './citation';

// Kinds whose detail renders from the citation alone; the others load their
// datum (event, trace, replay, ...) from the API.
const SELF_CONTAINED = new Set(['code', 'commit', 'pullRequest', 'external', 'feedback']);

export default Storybook.story('Citations', story => {
  story('Chips', () => {
    const [expanded, setExpanded] = useState<string | null>('c_code01');
    const current = EXAMPLE_CITATIONS.find(c => c.id === expanded);
    return (
      <Stack gap="md">
        <p>
          One chip per kind. Pressing a chip toggles its detail. Seer produces these from
          the data its tools read; see <code>static/app/components/seer/citations</code>.
        </p>
        <Flex gap="sm" wrap="wrap">
          {EXAMPLE_CITATIONS.map(citation => (
            <CitationChip
              key={citation.id}
              citation={citation}
              expanded={expanded === citation.id}
              onToggle={() => setExpanded(expanded === citation.id ? null : citation.id)}
            />
          ))}
        </Flex>
        {current && SELF_CONTAINED.has(current.kind) && (
          <CitationDetail citation={current} />
        )}
      </Stack>
    );
  });

  story('Detail', () => (
    <Stack gap="md">
      {EXAMPLE_CITATIONS.filter(c => SELF_CONTAINED.has(c.kind)).map(citation => (
        <CitationDetail key={citation.id} citation={citation} />
      ))}
    </Stack>
  ));
});
