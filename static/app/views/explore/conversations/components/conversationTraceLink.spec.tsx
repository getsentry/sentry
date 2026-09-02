import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {ConversationTrace} from 'sentry/views/explore/conversations/components/conversationTraceLink';
import {ConversationTraceLink} from 'sentry/views/explore/conversations/components/conversationTraceLink';

describe('ConversationTraceLink', () => {
  const organization = OrganizationFixture();

  function makeTraces(count: number): ConversationTrace[] {
    return Array.from({length: count}, (_, index) => ({
      traceId: `${index}`.repeat(32),
      spanId: `span${index}`,
    }));
  }

  it('renders nothing without traces', () => {
    const {container} = render(
      <ConversationTraceLink conversationId="conversation-1" traces={[]} />,
      {organization}
    );

    expect(container).toBeEmptyDOMElement();
  });

  it('links a single trace straight to the trace view', () => {
    render(
      <ConversationTraceLink
        conversationId="conversation-1"
        traces={[{traceId: 'a3805648ffffffffffffffffffffffff', spanId: 'span-1'}]}
      />,
      {organization}
    );

    const link = screen.getByRole('link', {name: 'a3805648'});
    expect(link).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/explore/traces/trace/a3805648ffffffffffffffffffffffff/?node=span-span-1`
    );
  });

  it('lists every trace and "View all" for multiple traces', async () => {
    render(
      <ConversationTraceLink conversationId="conversation-1" traces={makeTraces(2)} />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: /2 traces/}));

    expect(await screen.findByRole('menuitemradio', {name: '00000000'})).toHaveAttribute(
      'href',
      `/organizations/${organization.slug}/explore/traces/trace/${'0'.repeat(
        32
      )}/?node=span-span0`
    );
    expect(screen.getByRole('menuitemradio', {name: '11111111'})).toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'View all'})).toBeInTheDocument();
  });

  it('caps the listed traces and keeps "View all"', async () => {
    render(
      <ConversationTraceLink conversationId="conversation-1" traces={makeTraces(8)} />,
      {organization}
    );

    await userEvent.click(screen.getByRole('button', {name: /8 traces/}));

    expect(
      await screen.findByRole('menuitemradio', {name: '44444444'})
    ).toBeInTheDocument();
    expect(
      screen.queryByRole('menuitemradio', {name: '55555555'})
    ).not.toBeInTheDocument();
    expect(screen.getByRole('menuitemradio', {name: 'View all'})).toBeInTheDocument();
  });
});
