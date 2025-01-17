import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen} from 'sentry-test/reactTestingLibrary';

import QuickTrace from 'sentry/components/quickTrace';
import type {Event} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import type {QuickTraceEvent} from 'sentry/utils/performance/quickTrace/types';

describe('Quick Trace', function () {
  let location: any;
  let organization: Organization;

  const initialize = () => {
    const context = initializeOrg();
    organization = context.organization;
  };

  function makeQuickTraceEvents(generation: number, {n = 1, parentId = null} = {}) {
    const events: QuickTraceEvent[] = [];
    for (let i = 0; i < n; i++) {
      const suffix = n > 1 ? `-${i}` : '';
      events.push({
        event_id: `e${generation}${suffix}`,
        generation,
        span_id: `s${generation}${suffix}`,
        transaction: `t${generation}${suffix}`,
        'transaction.duration': 1234,
        project_id: generation,
        project_slug: `p${generation}`,
        parent_event_id:
          generation === 0 ? null : parentId === null ? `e${generation - 1}` : parentId,
        parent_span_id:
          generation === 0
            ? null
            : parentId === null
              ? `s${generation - 1}${parentId}`
              : `s${parentId}`,
        performance_issues: [],
        timestamp: 1615921516.132774,
      });
    }
    return events;
  }

  function makeTransactionEventFixture(id: string | number) {
    return {
      id: `e${id}`,
      type: 'transaction',
      startTimestamp: 1615921516.132774,
      endTimestamp: 1615921517.924861,
    };
  }

  function makeTransactionHref(pid: string, eid: string, transaction: string) {
    return `/organizations/${organization.slug}/performance/${pid}:${eid}/?transaction=${transaction}`;
  }

  beforeEach(function () {
    initialize();
    location = {
      pathname: '/',
      query: {},
    };
  });

  describe('Empty Trace', function () {
    it('renders nothing for empty trace', function () {
      const {container} = render(
        <QuickTrace
          event={makeTransactionEventFixture(1) as Event}
          quickTrace={{
            type: 'empty',
            trace: [],
          }}
          anchor="left"
          errorDest="issue"
          transactionDest="performance"
          location={location}
          organization={organization}
        />
      );
      expect(container).toHaveTextContent('\u2014');
    });
  });

  describe('Partial Trace', function () {
    it('renders nothing when partial trace is empty', function () {
      const {container} = render(
        <QuickTrace
          event={makeTransactionEventFixture(1) as Event}
          quickTrace={{
            type: 'partial',
            trace: null,
          }}
          anchor="left"
          errorDest="issue"
          transactionDest="performance"
          location={location}
          organization={organization}
        />
      );
      expect(container).toHaveTextContent('\u2014');
    });

    it('renders nothing when partial trace missing current event', function () {
      const {container} = render(
        <QuickTrace
          event={makeTransactionEventFixture('not-1') as Event}
          quickTrace={{
            type: 'partial',
            trace: makeQuickTraceEvents(1),
          }}
          anchor="left"
          errorDest="issue"
          transactionDest="performance"
          location={location}
          organization={organization}
        />
      );
      expect(container).toHaveTextContent('\u2014');
    });

    // TODO
    it('renders partial trace with no children', async function () {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/projects/`,
        body: [],
      });

      render(
        <QuickTrace
          event={makeTransactionEventFixture(4) as Event}
          quickTrace={{
            type: 'partial',
            trace: makeQuickTraceEvents(4),
          }}
          anchor="left"
          errorDest="issue"
          transactionDest="performance"
          location={location}
          organization={organization}
        />
      );
      const nodes = await screen.findAllByTestId('event-node');
      expect(nodes).toHaveLength(1);
      expect(nodes[0]).toHaveTextContent('This Event');
    });

    it('renders partial trace with single child', async function () {
      render(
        <QuickTrace
          event={makeTransactionEventFixture(4) as Event}
          quickTrace={{
            type: 'partial',
            trace: [...makeQuickTraceEvents(4), ...makeQuickTraceEvents(5)],
          }}
          anchor="left"
          errorDest="issue"
          transactionDest="performance"
          location={location}
          organization={organization}
        />
      );
      const nodes = await screen.findAllByTestId('event-node');
      expect(nodes).toHaveLength(2);
      ['This Event', '1 Child'].forEach((text, i) =>
        expect(nodes[i]).toHaveTextContent(text)
      );
    });

    it('renders partial trace with multiple children', async function () {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/projects/`,
        body: [],
      });

      render(
        <QuickTrace
          event={makeTransactionEventFixture(4) as Event}
          quickTrace={{
            type: 'partial',
            trace: [...makeQuickTraceEvents(4), ...makeQuickTraceEvents(5, {n: 3})],
          }}
          anchor="left"
          errorDest="issue"
          transactionDest="performance"
          location={location}
          organization={organization}
        />
      );
      const nodes = await screen.findAllByTestId('event-node');
      expect(nodes).toHaveLength(2);
      ['This Event', '3 Children'].forEach((text, i) =>
        expect(nodes[i]).toHaveTextContent(text)
      );
    });

    it('renders full trace with root as parent', async function () {
      render(
        <QuickTrace
          event={makeTransactionEventFixture(1) as Event}
          quickTrace={{
            type: 'partial',
            trace: [...makeQuickTraceEvents(0), ...makeQuickTraceEvents(1)],
          }}
          anchor="left"
          errorDest="issue"
          transactionDest="performance"
          location={location}
          organization={organization}
        />
      );
      const nodes = await screen.findAllByTestId('event-node');
      expect(nodes).toHaveLength(2);
      ['Parent', 'This Event'].forEach((text, i) =>
        expect(nodes[i]).toHaveTextContent(text)
      );
    });
  });

  describe('Full Trace', function () {
    it('renders full trace with single ancestor', async function () {
      render(
        <QuickTrace
          event={makeTransactionEventFixture(3) as Event}
          quickTrace={{
            type: 'full',
            trace: [
              ...makeQuickTraceEvents(0),
              ...makeQuickTraceEvents(1),
              ...makeQuickTraceEvents(2),
              ...makeQuickTraceEvents(3),
            ],
          }}
          anchor="left"
          errorDest="issue"
          transactionDest="performance"
          location={location}
          organization={organization}
        />
      );
      const nodes = await screen.findAllByTestId('event-node');
      expect(nodes).toHaveLength(4);
      ['Root', '1 Ancestor', 'Parent', 'This Event'].forEach((text, i) =>
        expect(nodes[i]).toHaveTextContent(text)
      );
    });

    it('renders full trace with multiple ancestors', async function () {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/projects/`,
        body: [],
      });

      render(
        <QuickTrace
          event={makeTransactionEventFixture(5) as Event}
          quickTrace={{
            type: 'full',
            trace: [
              ...makeQuickTraceEvents(0),
              ...makeQuickTraceEvents(1),
              ...makeQuickTraceEvents(2),
              ...makeQuickTraceEvents(3),
              ...makeQuickTraceEvents(4),
              ...makeQuickTraceEvents(5),
            ],
          }}
          anchor="left"
          errorDest="issue"
          transactionDest="performance"
          location={location}
          organization={organization}
        />
      );
      const nodes = await screen.findAllByTestId('event-node');
      expect(nodes).toHaveLength(4);
      ['Root', '3 Ancestors', 'Parent', 'This Event'].forEach((text, i) =>
        expect(nodes[i]).toHaveTextContent(text)
      );
    });

    it('renders full trace with single descendant', async function () {
      render(
        <QuickTrace
          event={makeTransactionEventFixture(0) as Event}
          quickTrace={{
            type: 'full',
            trace: [
              ...makeQuickTraceEvents(0),
              ...makeQuickTraceEvents(1),
              ...makeQuickTraceEvents(2),
            ],
          }}
          anchor="left"
          errorDest="issue"
          transactionDest="performance"
          location={location}
          organization={organization}
        />
      );
      const nodes = await screen.findAllByTestId('event-node');
      expect(nodes).toHaveLength(3);
      ['This Event', '1 Child', '1 Descendant'].forEach((text, i) =>
        expect(nodes[i]).toHaveTextContent(text)
      );
    });

    it('renders full trace with multiple descendants', async function () {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/projects/`,
        body: [],
      });

      render(
        <QuickTrace
          event={makeTransactionEventFixture(0) as Event}
          quickTrace={{
            type: 'full',
            trace: [
              ...makeQuickTraceEvents(0),
              ...makeQuickTraceEvents(1),
              ...makeQuickTraceEvents(2),
              ...makeQuickTraceEvents(3),
              ...makeQuickTraceEvents(4),
            ],
          }}
          anchor="left"
          errorDest="issue"
          transactionDest="performance"
          location={location}
          organization={organization}
        />
      );
      const nodes = await screen.findAllByTestId('event-node');
      expect(nodes).toHaveLength(3);
      ['This Event', '1 Child', '3 Descendants'].forEach((text, i) =>
        expect(nodes[i]).toHaveTextContent(text)
      );
    });

    it('renders full trace', async function () {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/projects/`,
        body: [],
      });

      render(
        <QuickTrace
          event={makeTransactionEventFixture(5) as Event}
          quickTrace={{
            type: 'full',
            trace: [
              ...makeQuickTraceEvents(0),
              ...makeQuickTraceEvents(1),
              ...makeQuickTraceEvents(2),
              ...makeQuickTraceEvents(3),
              ...makeQuickTraceEvents(4),
              ...makeQuickTraceEvents(5),
              ...makeQuickTraceEvents(6),
              ...makeQuickTraceEvents(7),
              ...makeQuickTraceEvents(8),
              ...makeQuickTraceEvents(9),
            ],
          }}
          anchor="left"
          errorDest="issue"
          transactionDest="performance"
          location={location}
          organization={organization}
        />
      );
      const nodes = await screen.findAllByTestId('event-node');
      expect(nodes).toHaveLength(6);
      ['Root', '3 Ancestors', 'Parent', 'This Event', '1 Child', '3 Descendants'].forEach(
        (text, i) => expect(nodes[i]).toHaveTextContent(text)
      );
    });
  });

  describe('Event Node Clicks', function () {
    it('renders single event targets', async function () {
      render(
        <QuickTrace
          event={makeTransactionEventFixture(3) as Event}
          quickTrace={{
            type: 'full',
            trace: [
              ...makeQuickTraceEvents(0),
              ...makeQuickTraceEvents(1),
              ...makeQuickTraceEvents(2),
              ...makeQuickTraceEvents(3),
              ...makeQuickTraceEvents(4),
              ...makeQuickTraceEvents(5),
            ],
          }}
          anchor="left"
          errorDest="issue"
          transactionDest="performance"
          location={location}
          organization={organization}
        />
      );
      const nodes = await screen.findAllByTestId('event-node');
      expect(nodes).toHaveLength(6);
      [
        makeTransactionHref('p0', 'e0', 't0'),
        makeTransactionHref('p1', 'e1', 't1'),
        makeTransactionHref('p2', 'e2', 't2'),
        undefined, // the "This Event" node has no target
        makeTransactionHref('p4', 'e4', 't4'),
        makeTransactionHref('p5', 'e5', 't5'),
      ].forEach((target, i) => {
        const linkNode = nodes[i]!.children[0];
        if (target) {
          expect(linkNode).toHaveAttribute('href', target);
        } else {
          expect(linkNode).not.toHaveAttribute('href');
        }
      });
    });

    it('renders multiple event targets', async function () {
      MockApiClient.addMockResponse({
        url: `/organizations/${organization.slug}/projects/`,
        body: [],
      });

      render(
        <QuickTrace
          event={makeTransactionEventFixture(0) as Event}
          quickTrace={{
            type: 'full',
            trace: [...makeQuickTraceEvents(0), ...makeQuickTraceEvents(1, {n: 3})],
          }}
          anchor="left"
          errorDest="issue"
          transactionDest="performance"
          location={location}
          organization={organization}
        />
      );
      const items = await screen.findAllByTestId('dropdown-item');
      expect(items).toHaveLength(3);
      // can't easily assert the target is correct since it uses an onClick handler
    });
  });
});
