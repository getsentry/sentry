import {Fragment} from 'react';

import {Container} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import * as Storybook from 'sentry/stories';
import {NextStepCard} from 'sentry/views/investigations/actionRequests/nextStepCard';
import {InvestigationActionRequestFixture} from 'sentry/views/investigations/fixtures';
import type {InvestigationActionRequest} from 'sentry/views/investigations/types';

const intervalChange = InvestigationActionRequestFixture({
  title: 'Change the monitor’s interval from 1 minute to 10 minutes',
  rationale:
    'One or two slow requests at night don’t move a 10-minute p95, and it still catches sustained slowdowns.',
  impact:
    'Last 30 days with these settings: 1 issue instead of 15, and the Sep 12 slowdown still caught.',
});

function CardStory({actionRequests}: {actionRequests: InvestigationActionRequest[]}) {
  return (
    <Container maxWidth="960px">
      <NextStepCard actionRequests={actionRequests} />
    </Container>
  );
}

export default Storybook.story('Investigations — Recommended Action', story => {
  story('Suggested', () => (
    <Fragment>
      <Text as="p">
        Seer's primary request from the latest report sits under the summary.
      </Text>
      <CardStory actionRequests={[intervalChange]} />
    </Fragment>
  ));

  story('No action', () => (
    <Fragment>
      <Text as="p">
        Advice Seer cannot carry out has no action, so the card shows the advice only.
      </Text>
      <CardStory
        actionRequests={[
          {
            ...intervalChange,
            title: 'Instrument checkout retries',
            rationale:
              'Retries are invisible in spans, so the timeout cause could not be confirmed.',
            impact: null,
            action: null,
          },
        ]}
      />
    </Fragment>
  ));

  story('Withdrawn', () => (
    <CardStory
      actionRequests={[
        {
          ...intervalChange,
          state: 'withdrawn',
          reason: 'A second look showed the spikes are real breaches.',
        },
      ]}
    />
  ));
});
