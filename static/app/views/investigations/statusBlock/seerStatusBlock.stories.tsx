import {Fragment} from 'react';

import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {IconAdd} from 'sentry/icons';
import * as Storybook from 'sentry/stories';
import {SeerStatusBlock} from 'sentry/views/investigations/statusBlock/seerStatusBlock';

export default Storybook.story('Investigations — Seer status block', story => {
  story('While the agent is working', () => (
    <Fragment>
      <p>
        The status block is the line above the hypotheses that says what Seer is doing.
        There is exactly one on the page, in a fixed spot, for the whole life of a run —
        so a reader who has learned where to look for "what is happening" never has to
        relearn it when the run changes state.
      </p>
      <p>
        Every phase the agent moves through on its own — gathering context, forming
        hypotheses, checking evidence, composing the report — is the same{' '}
        <code>running</code> variant. They differ in what they say, not how they look,
        which is why the sentence is a prop rather than another variant. The status badge
        appears beside the investigation title in the page header.
      </p>
      <Storybook.Demo direction="column" align="stretch" maxHeight="none">
        <Stack gap="xl">
          <SeerStatusBlock
            variant="running"
            title="Seer is gathering context for the FCP spike"
            description="Comparing server timing, cache activity, SSO, and browser rendering. No input needed."
            elapsed="56.4s"
          />
          <SeerStatusBlock
            variant="running"
            title="Seer is looking for likely causes"
            description="Possible hypothesis will appear here as Seer connects the evidence. No input needed."
            elapsed="101.5s"
          />
          <SeerStatusBlock
            variant="running"
            title="Seer found four possible causes and is checking for evidence"
            description="Four possible causes are found, now Seer is checking for evidence to validate the hypothesis."
            elapsed="101.5s"
          />
          <SeerStatusBlock
            variant="running"
            title="Seer is bringing the findings together"
            meta="4 possible causes • 9 checks completed"
            description="Organizing the explanation, supporting evidence, and next steps. Your investigation will open automatically."
            elapsed="101.5s"
          />
        </Stack>
      </Storybook.Demo>
    </Fragment>
  ));

  story('When it needs something back', () => (
    <Fragment>
      <p>
        <code>awaitingInput</code> is the only state that has stopped <em>recoverably</em>
        , and the only one that renders an <code>action</code>. Every other state is the
        agent's to advance, so giving them a button would imply the viewer is holding
        things up when they are not.
      </p>
      <p>
        It is also one of only two states that colour their title. A run that is simply
        working, or has finished cleanly, leaves the sentence in the ordinary heading
        colour and lets the header badge carry the state — otherwise every block on the
        page shouts and none of them reads as urgent.
      </p>
      <Storybook.Demo direction="column" align="stretch" maxHeight="none">
        <SeerStatusBlock
          variant="awaitingInput"
          title="Seer needs infrastructure metrics to continue"
          description="Available traces can't distinguish database/cache degradation from session-validation delays. Connect Datadog to continue; Seer will resume after authorization."
          elapsed="101.5s"
          action={
            <Flex justify="between" align="center" gap="xl" wrap="wrap">
              <Stack gap="2xs">
                <Text size="md" bold>
                  Datadog
                </Text>
                <Text size="sm">Redis resource pressure and database latency</Text>
                <Text size="sm" variant="muted">
                  Aug 27, 09:00–11:00 UTC
                </Text>
              </Stack>
              <Button variant="primary" icon={<IconAdd />}>
                Connect Datadog
              </Button>
            </Flex>
          }
        />
      </Storybook.Demo>
    </Fragment>
  ));

  story('When it has stopped', () => (
    <Fragment>
      <p>
        A failure is the other state that colours its title, because it is the only one
        where nothing further will happen without someone reading the sentence.
      </p>
      <p>
        <code>cancelled</code> is not in the design. It is here because the projection can
        report it and the block still has to render something: falling through to{' '}
        <code>failed</code> would paint a decision someone deliberately made bright red,
        so it gets the neutral treatment instead.
      </p>
      <Storybook.Demo direction="column" align="stretch" maxHeight="none">
        <Stack gap="xl">
          <SeerStatusBlock
            variant="failed"
            title="Seer couldn't finish checking the evidence"
            description="The trace request timed out. Completed checks are saved. Retry to continue from this step."
            elapsed="101.5s"
          />
          <SeerStatusBlock
            variant="cancelled"
            title="This investigation was stopped"
            description="Checks that had already finished are saved. Start a new investigation to pick the question back up."
            elapsed="42.0s"
          />
        </Stack>
      </Storybook.Demo>
    </Fragment>
  ));

  story('When it is done', () => (
    <Fragment>
      <p>
        The finished block is the one people scroll back to, so it carries a tally: how
        many explanations were weighed, and how many checks stand behind them. The{' '}
        <code>meta</code> line only appears once there is something to count, which is why
        it is absent from the early running states above.
      </p>
      <Storybook.Demo direction="column" align="stretch" maxHeight="none">
        <SeerStatusBlock
          variant="complete"
          title="Your investigation is ready"
          meta="4 possible causes • 9 checks completed"
          description="Findings, supporting evidence, and recommended next steps are ready."
          elapsed="191.6s"
        />
      </Storybook.Demo>
    </Fragment>
  ));

  story('Without an elapsed time', () => (
    <Fragment>
      <p>
        <code>elapsed</code> is optional, and the wired block currently leaves it out. The
        projection carries no run-level start time — <code>startedAt</code> exists only on
        individual block executions — so there is nothing honest to count from yet. The
        prop is here because the design calls for it and the story can show it; the
        component will start receiving a real value when the projection grows one.
      </p>
      <p>
        When it is supplied it renders monospace and tabular, so the counter stays stable
        as its value changes.
      </p>
      <Storybook.Demo direction="column" align="stretch" maxHeight="none">
        <SeerStatusBlock
          variant="running"
          title="Seer found three possible causes and is checking for evidence"
          description="Three possible causes are found, now Seer is checking for evidence to validate the hypothesis."
        />
      </Storybook.Demo>
    </Fragment>
  ));

  story('In a narrow container', () => (
    <Fragment>
      <p>
        The clock holds the top-right corner and the title wraps around it. The status
        badge lives in the page header. Drag the demo's edge to watch it.
      </p>
      <Storybook.Demo resizable direction="column" align="stretch">
        <SeerStatusBlock
          variant="running"
          title="Seer found four possible causes and is checking for evidence"
          description="Four possible causes are found, now Seer is checking for evidence to validate the hypothesis."
          elapsed="101.5s"
        />
      </Storybook.Demo>
    </Fragment>
  ));
});
