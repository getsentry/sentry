import {createRef} from 'react';
import {EventFixture} from 'sentry-fixture/event';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {IssuesTraceTree} from 'sentry/views/performance/traceDetails/traceModels/issuesTraceTree';
import {
  makeEAPTrace,
  makeUptimeCheck,
} from 'sentry/views/performance/traceDetails/traceModels/traceTreeTestUtils';

import type {VirtualizedViewManager} from './traceRenderers/virtualizedViewManager';
import {IssueTraceWaterfallOverlay} from './issuesTraceWaterfallOverlay';

describe('IssueTraceWaterfallOverlay', () => {
  it('does not carry issue list filters into the trace target', () => {
    const event = EventFixture({
      contexts: {
        trace: {
          trace_id: '123',
        },
      },
      occurrence: {
        evidenceData: {offenderSpanIds: ['offender-span-id']},
      },
    });
    const organization = OrganizationFixture({features: ['performance-view']});
    const viewManager = {
      row_measurer: {
        off: jest.fn(),
        on: jest.fn(),
      },
    } as unknown as VirtualizedViewManager;

    render(
      <IssueTraceWaterfallOverlay
        containerRef={createRef<HTMLDivElement>()}
        event={event}
        groupId={event.groupID}
        tree={{list: []} as unknown as IssuesTraceTree}
        viewManager={viewManager}
        source="issues"
      />,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: `/organizations/${organization.slug}/issues/${event.groupID}/`,
            query: {
              project: '1',
              query: 'is:unresolved issue.category:[error,outage]',
              referrer: 'issue-stream',
            },
          },
        },
      }
    );

    const link = screen.getByRole('link');
    const url = new URL(link.getAttribute('href')!, 'https://example.com');

    expect(url.pathname).toBe(`/organizations/${organization.slug}/issues/trace/123/`);
    expect(url.searchParams.get('groupId')).toBe(event.groupID);
    expect(url.searchParams.get('referrer')).toBe('issue-stream');
    expect(url.searchParams.get('source')).toBe('issue_details');
    expect(url.searchParams.getAll('node')).toEqual(['span-offender-span-id']);
    expect(url.searchParams.has('project')).toBe(false);
    expect(url.searchParams.has('query')).toBe(false);
  });

  it('uses the matching trace node path when there is no offender span', () => {
    const event = EventFixture({
      contexts: {
        trace: {
          trace_id: '123',
        },
      },
    });
    const organization = OrganizationFixture({features: ['performance-view']});
    const viewManager = {
      row_measurer: {
        off: jest.fn(),
        on: jest.fn(),
      },
    } as unknown as VirtualizedViewManager;
    const tree = IssuesTraceTree.FromTrace(
      makeEAPTrace([makeUptimeCheck({event_id: event.eventID})]),
      {organization, replay: null}
    );

    render(
      <IssueTraceWaterfallOverlay
        containerRef={createRef<HTMLDivElement>()}
        event={event}
        groupId={event.groupID}
        tree={tree}
        viewManager={viewManager}
        source="issues"
      />,
      {organization}
    );

    const link = screen.getByRole('link');
    const url = new URL(link.getAttribute('href')!, 'https://example.com');

    expect(url.searchParams.getAll('node')).toEqual([`uptime-check-${event.eventID}`]);
  });
});
