import type {ReactNode} from 'react';

import {Button} from '@sentry/scraps/button';
import {AssistantMessage, MessageRow, UserMessage} from '@sentry/scraps/chat';
import {InputGroup} from '@sentry/scraps/input';
import {Container, Stack} from '@sentry/scraps/layout';

import type {AutofixExplorerStep} from 'sentry/components/events/autofix/useExplorerAutofix';
import {SeerMarkdown} from 'sentry/components/seer/markdown';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';
import {IconArrow} from 'sentry/icons';
import * as Storybook from 'sentry/stories';

const ISSUE = {id: '6789012345', shortId: 'CHECKOUT-42'};

/**
 * Taken from the embed schema so these fixtures fail to compile rather than
 * silently drop a field if the structured payload changes shape.
 */
type AutofixDetails = Pick<
  EmbedOutput<'autofix'>,
  'fiveWhys' | 'reproductionSteps' | 'steps'
>;

function autofix(
  step: AutofixExplorerStep,
  result: string,
  details: AutofixDetails = {}
): string {
  return `{% autofix %}${JSON.stringify({...ISSUE, step, result, ...details})}{% /autofix %}`;
}

const ROOT_CAUSE = autofix(
  'root_cause',
  '`CartService.total()` reduces the line items without an initial accumulator, so an empty cart throws `TypeError: Reduce of empty array with no initial value` and `POST /api/checkout/quote` 500s.',
  {
    fiveWhys: [
      '`POST /api/checkout/quote` returned a 500 for every request carrying an empty cart.',
      '`CartService.total()` threw `TypeError: Reduce of empty array with no initial value`.',
      '`items.reduce((sum, item) => sum + item.price)` is called without a second argument.',
      'Without an initial value `reduce` seeds itself from the first element, which an empty array does not have.',
      'The empty-cart path was never exercised — every fixture in `cartService.test.ts` seeds at least one line item.',
    ],
    reproductionSteps: [
      'Sign in as any customer and add one item to the cart.',
      'Remove that item, leaving the cart empty.',
      'Navigate to `/checkout`, which calls `POST /api/checkout/quote` on mount.',
      'The request 500s and the page falls back to the generic error state.',
    ],
  }
);

const SOLUTION = autofix(
  'solution',
  'Seed the reduction with `0` so an empty cart totals to zero instead of throwing.',
  {
    steps: [
      {
        title: 'Pass an initial accumulator to `CartService.total()`',
        description:
          'Change `items.reduce((sum, item) => sum + item.price)` to pass `0` as the second argument.',
      },
      {
        title: 'Cover the empty cart in `cartService.test.ts`',
        description: 'Assert `total()` returns `0` for an empty line-item array.',
      },
    ],
  }
);

const CODE_CHANGES = autofix(
  'code_changes',
  '2 files changed in 1 repo — `src/checkout/cartService.ts` now passes the initial value, and `src/checkout/cartService.test.ts` covers the empty-cart path.'
);

// Autofix has no "plan" step — a plan is the write-up of the solution step.
const PLANNED_SOLUTION = autofix(
  'solution',
  'Guard `CartService.total()` against an empty cart, then close the coverage gap that let this ship.',
  {
    steps: [
      {
        title: 'Pass an initial accumulator to `CartService.total()`',
        description:
          'Change `items.reduce((sum, item) => sum + item.price)` to pass `0` as the second argument.',
      },
      {
        title: 'Cover the empty cart in `cartService.test.ts`',
        description: 'Assert `total()` returns `0` for an empty line-item array.',
      },
      {
        title: 'Add a checkout smoke test with zero items',
        description:
          'Render `/checkout` with an empty cart and assert the quote renders `$0.00` instead of the error state.',
      },
    ],
  }
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
        {ISSUE.shortId} all the way?
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
      <User>What's the status of Autofix on {ISSUE.shortId}?</User>
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
      <Seer raw={`It's ${ISSUE.shortId}, and it accounts for most of the new volume.`} />
      <User>Show me the root cause of {ISSUE.shortId}.</User>
      <Seer raw={ROOT_CAUSE} />
    </ChatShell>
  ));

  story('From root cause to a plan', () => (
    <ChatShell>
      <Seer
        raw={`I dug into ${ISSUE.shortId} and here's the root cause:\n\n${ROOT_CAUSE}`}
      />
      <User>So it only breaks when the cart is completely empty?</User>
      <Seer raw="Exactly — any cart with at least one item supplies the accumulator implicitly, so the crash is scoped to the empty-cart path." />
      <User>Got it. Put together a plan to fix it.</User>
      <Seer raw={`Here's the plan:\n\n${PLANNED_SOLUTION}`} />
    </ChatShell>
  ));
});
