import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {OverviewCard} from './issueCard';
import type {OverviewRun} from './types';

describe('OverviewCard', () => {
  const organization = OrganizationFixture();

  function runFixture(overrides: Partial<OverviewRun> = {}): OverviewRun {
    return {
      groupId: '2',
      shortId: 'PROJ-1',
      title: 'TypeError in checkout cart',
      rootCause: {
        headline: null,
        oneLineDescription: 'The cart total is read before it is set.',
      },
      proposedFix: null,
      seerRunId: 'run-1',
      lastTriggeredAt: '2026-07-14T09:00:00Z',
      pullRequests: [],
      status: null,
      issue: {
        ...GroupFixture(),
        count: '10',
        userCount: 2,
        owners: [],
        substatus: 'ongoing',
        project: {id: '2', slug: 'project-slug', platform: 'python'},
      },
      ...overrides,
    };
  }

  const cardProps = {
    orgSlug: organization.slug,
    statsPeriod: null,
    scmSettled: true,
    vitalsPending: false,
    requestScmWindow: jest.fn(),
    scmWindows: undefined,
    projectConfig: undefined,
    assigneeReady: false,
  };

  it.each([
    {
      sectionKey: 'needs_investigation',
      label: 'Error',
      message: 'Seer ran into an error after finding the root cause. Open Seer to retry.',
      nextAction: 'Create Plan',
    },
    {
      sectionKey: 'code_changes_ready',
      label: 'Code Changes',
      message: 'Seer ran into an error on the latest attempt. Open Seer to retry.',
      nextAction: 'Draft PR',
    },
  ] as const)(
    'shows the error state for an errored $sectionKey run',
    ({sectionKey, label, message, nextAction}) => {
      render(
        <OverviewCard
          {...cardProps}
          run={runFixture({status: 'error'})}
          sectionKey={sectionKey}
        />,
        {organization}
      );

      expect(screen.getByText(label)).toBeInTheDocument();
      expect(screen.getByText(message)).toBeInTheDocument();
      expect(screen.queryByRole('button', {name: nextAction})).not.toBeInTheDocument();
      expect(screen.getByRole('button', {name: 'Open Seer'})).toBeInTheDocument();
    }
  );

  it('shows the next action for a healthy needs_investigation run', () => {
    render(
      <OverviewCard
        {...cardProps}
        run={runFixture({status: 'completed'})}
        sectionKey="needs_investigation"
      />,
      {organization}
    );

    expect(
      screen.getByText('The cart total is read before it is set.')
    ).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Create Plan'})).toBeInTheDocument();
    expect(
      screen.queryByText(
        'Seer ran into an error after finding the root cause. Open Seer to retry.'
      )
    ).not.toBeInTheDocument();
  });
});
