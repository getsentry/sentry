import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import * as Storybook from 'sentry/stories';
import {InvestigationReplay} from 'sentry/views/investigations/__stories__/investigationReplay';
import {recordedInvestigationRun} from 'sentry/views/investigations/__stories__/recordedRun';

export default Storybook.story('Investigations — Recorded Run', story => {
  story('Replay a real investigation', () => (
    <Stack gap="lg">
      <Text variant="muted">
        A real agentic investigation captured from sentry.io, replayed against the detail
        page one recorded response at a time. The run took{' '}
        {Math.round(recordedInvestigationRun.durationMs / 1000)} seconds end to end and
        moved through broad scan, hypothesis investigation, judging, report composition
        and metadata generation. Press play to watch it at the pace it actually ran, or
        drag the scrubber to jump to any point. Editing is disabled — the page is being
        served a recording, not a live workflow.
      </Text>
      <InvestigationReplay organizationSlug="storybook-investigation-replay" />
    </Stack>
  ));
});
