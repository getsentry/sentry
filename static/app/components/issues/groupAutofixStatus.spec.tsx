import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

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
      status: 'Not started',
      nextStep: 'Find root cause',
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

  it('renders nothing when AI features are hidden', () => {
    const {container} = render(<GroupAutofixStatus group={GroupFixture()} />, {
      organization: OrganizationFixture({hideAiFeatures: true}),
    });

    expect(container).toBeEmptyDOMElement();
  });
});
