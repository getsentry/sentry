import type {ReactNode} from 'react';

import {Button} from '@sentry/scraps/button';
import {AssistantMessage, MessageRow, UserMessage} from '@sentry/scraps/chat';
import {InputGroup} from '@sentry/scraps/input';
import {Container, Stack} from '@sentry/scraps/layout';

import {SeerMarkdown} from 'sentry/components/seer/markdown';
import {IconArrow} from 'sentry/icons';
import * as Storybook from 'sentry/stories';

const ISSUE = {issue_short_id: 'CHECKOUT-42', issue_id: '6789012345'};

function autofix(step: string, result: string): string {
  return `{% autofix %}${JSON.stringify({...ISSUE, step, result})}{% /autofix %}`;
}

const ROOT_CAUSE = autofix(
  'Root Cause',
  '`CartService.total()` calls `items.reduce((sum, item) => sum + item.price)` without an initial accumulator. When a customer empties their cart the array is empty, so `reduce` throws `TypeError: Reduce of empty array with no initial value` and the checkout request 500s.'
);

const SOLUTION = autofix(
  'Solution',
  'Seed the reduction with `0` so an empty cart totals to zero instead of throwing: `items.reduce((sum, item) => sum + item.price, 0)`.'
);

const CODE_CHANGES = autofix(
  'Code Changes',
  'Updated `src/checkout/cartService.ts` to pass the initial value and added a regression test covering the empty-cart path.'
);

const PLAN = autofix(
  'Plan',
  'Guard `CartService.total()` with an initial accumulator of `0`, add a regression test covering the empty-cart path, then backfill a smoke test that renders the checkout page with zero items.'
);

function User({children}: {children: ReactNode}) {
  return (
    <MessageRow from="user">
      <UserMessage>{children}</UserMessage>
    </MessageRow>
  );
}

function Assistant({children}: {children: ReactNode}) {
  return (
    <MessageRow from="assistant">
      <AssistantMessage>{children}</AssistantMessage>
    </MessageRow>
  );
}

function Seer({raw}: {raw: string}) {
  return (
    <Assistant>
      <SeerMarkdown raw={raw} />
    </Assistant>
  );
}

function ChatShell({children}: {children: ReactNode}) {
  return (
    <Storybook.SizingWindow display="block">
      <Stack
        width="100%"
        maxWidth="518px"
        height="640px"
        background="primary"
        border="primary"
        radius="md"
        overflow="hidden"
      >
        <Container flex="1" overflow="auto">
          {children}
        </Container>
        <Container borderTop="primary" background="primary" padding="lg xl">
          <InputGroup>
            <InputGroup.TextArea
              rows={1}
              autosize
              maxRows={5}
              size="md"
              placeholder="Ask Seer a question, or press / for commands."
            />
            <InputGroup.TrailingItems>
              <Button
                size="xs"
                variant="transparent"
                icon={<IconArrow direction="right" />}
                aria-label="Send message"
              />
            </InputGroup.TrailingItems>
          </InputGroup>
        </Container>
      </Stack>
    </Storybook.SizingWindow>
  );
}

export default Storybook.story('Autofix', story => {
  story('Fix it end to end', () => (
    <ChatShell>
      <User>
        The checkout page is throwing errors for a bunch of users. Can you fix{' '}
        {ISSUE.issue_short_id} all the way?
      </User>
      <Seer
        raw={`On it — running Autofix now. First, the root cause:\n\n${ROOT_CAUSE}`}
      />
      <Seer raw={`Here's the fix I'd apply:\n\n${SOLUTION}`} />
      <Seer
        raw={`And the changes are ready:\n\n${CODE_CHANGES}\n\nWant me to open a pull request?`}
      />
    </ChatShell>
  ));

  story('Ask for current status', () => (
    <ChatShell>
      <User>What's the status of Autofix on {ISSUE.issue_short_id}?</User>
      <Seer
        raw={`Autofix has reached the last step. Here's where it landed:\n\n${CODE_CHANGES}`}
      />
    </ChatShell>
  ));

  story('Ask for the root cause mid-chat', () => (
    <ChatShell>
      <User>Hey, are error rates up today?</User>
      <Seer raw="Yes — checkout errors spiked about 40 minutes ago, concentrated on the `/checkout` endpoint." />
      <User>Ugh. Which issue is it?</User>
      <Seer
        raw={`It's ${ISSUE.issue_short_id}, and it accounts for most of the new volume.`}
      />
      <User>Show me the root cause of {ISSUE.issue_short_id}.</User>
      <Seer raw={ROOT_CAUSE} />
    </ChatShell>
  ));

  story('From root cause to a plan', () => (
    <ChatShell>
      <Seer
        raw={`I dug into ${ISSUE.issue_short_id} and here's the root cause:\n\n${ROOT_CAUSE}`}
      />
      <User>So it only breaks when the cart is completely empty?</User>
      <Seer raw="Exactly — any cart with at least one item supplies the accumulator implicitly, so the crash is scoped to the empty-cart path." />
      <User>Got it. Put together a plan to fix it.</User>
      <Seer raw={`Here's the plan:\n\n${PLAN}`} />
    </ChatShell>
  ));
});
