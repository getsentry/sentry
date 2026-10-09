import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  getAutofixState,
  GroupAutofixStatus,
} from 'sentry/components/issues/groupAutofixStatus';
import {ProgressState} from 'sentry/types/group';

const derivedData = {
  hasOpenFixPr: false,
  hasRootCause: false,
  isAssigned: false,
  lastProgressedAt: null,
  progress: ProgressState.IDENTIFIED,
  status: 'open' as const,
  viewCount: 0,
};

describe('getAutofixState', () => {
  it('prefers what Autofix is blocked on over the last completed step', () => {
    expect(
      getAutofixState(
        GroupFixture({
          derivedData: {
            ...derivedData,
            blocker: 'approve_plan',
            lastCompletedAutofixStep: 'solution',
          },
        })
      )
    ).toEqual({status: 'Plan ready', nextStep: 'Review plan'});
  });

  it('only offers to view an open PR', () => {
    expect(
      getAutofixState(GroupFixture({derivedData: {...derivedData, blocker: 'merge_pr'}}))
    ).toEqual({status: null, nextStep: 'View PR'});
  });

  it('offers the step after the last completed one', () => {
    expect(
      getAutofixState(
        GroupFixture({
          derivedData: {
            ...derivedData,
            blocker: 'none',
            lastCompletedAutofixStep: 'root_cause',
          },
        })
      )
    ).toEqual({status: 'Root cause found', nextStep: 'Make a plan'});
  });

  it('falls back to whether a run happened without derived data', () => {
    expect(getAutofixState(GroupFixture({seerAutofixLastTriggered: null}))).toEqual({
      status: null,
      nextStep: 'Start Autofix',
    });
    expect(
      getAutofixState(GroupFixture({seerAutofixLastTriggered: new Date().toISOString()}))
    ).toEqual({status: 'In progress', nextStep: 'Open Seer'});
  });
});

describe('GroupAutofixStatus', () => {
  it('links the next step to Seer for the issue', () => {
    render(
      <GroupAutofixStatus
        group={GroupFixture({
          id: '42',
          derivedData: {...derivedData, lastCompletedAutofixStep: 'code_changes'},
        })}
      />
    );

    expect(screen.getByText('Code changes written')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Draft PR'})).toHaveAttribute(
      'href',
      expect.stringContaining('/issues/42/')
    );
  });

  it('starts a run through every step for an issue without one', async () => {
    const startRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/7/autofix/',
      method: 'POST',
      body: {run_id: 1},
    });

    render(
      <GroupAutofixStatus
        group={GroupFixture({id: '7', seerAutofixLastTriggered: null})}
      />
    );

    expect(screen.queryByText('Not started')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Start Autofix'}));

    expect(startRequest).toHaveBeenCalledWith(
      '/organizations/org-slug/issues/7/autofix/',
      expect.objectContaining({
        query: {mode: 'explorer'},
        data: {step: 'root_cause', stopping_point: 'open_pr', referrer: 'api.web'},
      })
    );
    expect(await screen.findByText('In progress')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Open Seer'})).toHaveAttribute('href');
  });

  it('renders nothing when AI features are hidden', () => {
    const {container} = render(<GroupAutofixStatus group={GroupFixture()} />, {
      organization: OrganizationFixture({hideAiFeatures: true}),
    });

    expect(container).toBeEmptyDOMElement();
  });
});
