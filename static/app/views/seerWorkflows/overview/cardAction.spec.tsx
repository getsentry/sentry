import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  deriveCardAction,
  IssuePrimaryAction,
} from 'sentry/views/seerWorkflows/overview/cardAction';
import type {
  AutofixStateKey,
  CardAction,
  OverviewRow,
  RunStatus,
} from 'sentry/views/seerWorkflows/overview/types';

function makeRow(overrides: Partial<OverviewRow> = {}): OverviewRow {
  return {
    analysis: [],
    eventCount: 1,
    id: '2',
    lastActivityAt: '2026-07-14T10:00:00Z',
    level: 'error',
    project: {slug: 'proj'},
    runStatus: null,
    shortId: 'PROJ-1',
    statePending: false,
    statsPeriod: '90d',
    title: 'Boom',
    userCount: 0,
    ...overrides,
  };
}

const runUrl = {
  pathname: '/organizations/org-slug/issues/2/',
  query: {seerDrawer: 'true'},
};

describe('deriveCardAction', () => {
  it.each([
    'code_changes_ready',
    'solution_ready',
    'needs_investigation',
    'merged',
  ] as AutofixStateKey[])('maps the %s section to its own action', sectionKey => {
    expect(deriveCardAction(sectionKey, makeRow())).toEqual({type: sectionKey});
  });

  it('carries the linked PR on the review_pr action', () => {
    const action = deriveCardAction(
      'review_pr',
      makeRow({prUrl: 'https://github.com/o/r/pull/9', prNumber: 9})
    );
    expect(action).toEqual({
      type: 'review_pr',
      prUrl: 'https://github.com/o/r/pull/9',
      prNumber: 9,
    });
  });
});

describe('IssuePrimaryAction', () => {
  function renderAction(action: CardAction, row: OverviewRow) {
    return render(<IssuePrimaryAction action={action} row={row} runUrl={runUrl} />);
  }

  it('renders a placeholder while the run state is pending', () => {
    renderAction({type: 'needs_investigation'}, makeRow({statePending: true}));

    expect(screen.getByText('…')).toBeInTheDocument();
    expect(screen.queryByRole('button')).not.toBeInTheDocument();
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it.each([
    {runStatus: 'processing' as RunStatus, overlay: 'Running'},
    {runStatus: 'error' as RunStatus, overlay: 'Retry'},
    {runStatus: 'awaiting_user_input' as RunStatus, overlay: 'Add context'},
  ])(
    'paints the $overlay overlay over the section action when the run is $runStatus',
    ({runStatus, overlay}) => {
      // A review_pr card (section anchor) whose live run is mid-flight: the
      // overlay shows and the Review PR anchor is hidden, but the section is
      // not reclassified — see the anchor assertion below.
      const action: CardAction = {
        type: 'review_pr',
        prUrl: 'https://github.com/o/r/pull/9',
        prNumber: 9,
      };
      renderAction(action, makeRow({runStatus}));

      expect(screen.getByText(overlay)).toBeInTheDocument();
      expect(screen.queryByRole('button', {name: 'Review PR'})).not.toBeInTheDocument();
    }
  );

  it('shows the section-driven Review PR anchor once no overlay applies', () => {
    const action: CardAction = {
      type: 'review_pr',
      prUrl: 'https://github.com/o/r/pull/9',
      prNumber: 9,
    };
    renderAction(action, makeRow({runStatus: 'completed'}));

    expect(screen.getByRole('button', {name: 'Review PR'})).toHaveAttribute(
      'href',
      'https://github.com/o/r/pull/9'
    );
  });

  it.each([
    {type: 'merged', label: 'Merged'},
    {type: 'code_changes_ready', label: 'Open PR'},
    {type: 'solution_ready', label: 'Generate code'},
    {type: 'needs_investigation', label: 'Investigate'},
  ] as Array<{label: string; type: Exclude<CardAction['type'], 'review_pr'>}>)(
    'renders the $label action for a completed $type card',
    ({type, label}) => {
      renderAction({type}, makeRow({runStatus: 'completed'}));

      expect(screen.getByText(label)).toBeInTheDocument();
    }
  );

  it('falls back to the internal review link when a review_pr card has no PR url', () => {
    renderAction(
      {type: 'review_pr', prUrl: undefined, prNumber: undefined},
      makeRow({runStatus: 'completed'})
    );

    expect(screen.getByRole('button', {name: 'Review PR'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/2/?seerDrawer=true'
    );
  });
});
