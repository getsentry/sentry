import {Fragment} from 'react';

import {Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import * as Storybook from 'sentry/stories';
import {InvestigationSummaryCard} from 'sentry/views/investigations/investigationSummaryCard';

export default Storybook.story('Investigations — Summary Card', story => {
  story('Filled summary', () => (
    <Fragment>
      <p>
        Completed investigations surface a short headline and supporting description above
        the notebook cells.
      </p>
      <InvestigationSummaryCard
        summary="Errors rose across releases"
        summaryDescription={
          'All active releases increased together.\nCheck shared infrastructure and dependencies.'
        }
      />
    </Fragment>
  ));

  story('Missing fields render nothing', () => (
    <Stack gap="md">
      <Text size="sm" variant="muted">
        Summary only
      </Text>
      <InvestigationSummaryCard
        summary="Errors rose across releases"
        summaryDescription={null}
      />
      <Text size="sm" variant="muted">
        Description only
      </Text>
      <InvestigationSummaryCard
        summary={null}
        summaryDescription="All active releases increased together."
      />
      <Text size="sm" variant="muted">
        Empty card placeholders stay blank so incomplete generation does not flash UI.
      </Text>
    </Stack>
  ));
});
