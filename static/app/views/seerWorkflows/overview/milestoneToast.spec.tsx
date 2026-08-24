import {GitHubIntegrationFixture} from 'sentry-fixture/githubIntegration';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import * as indicators from 'sentry/actionCreators/indicator';
import {trackAnalytics} from 'sentry/utils/analytics';

import {MilestoneToast, useMilestoneAdvanceToasts} from './milestoneToast';
import type {AutofixOverviewResponse, OverviewRun} from './types';

jest.mock('sentry/utils/analytics');

const organization = OrganizationFixture();

const run = (overrides: Partial<OverviewRun> = {}): OverviewRun =>
  ({groupId: '2', shortId: 'SEER-1', seerRunId: 'run-1', ...overrides}) as OverviewRun;

const emptyMilestones = {
  autofix_root_cause: [],
  autofix_solution: [],
  autofix_code_changes: [],
  has_pull_request: [],
  pull_requests_merged: [],
};

const response = (
  partial: Partial<AutofixOverviewResponse['runsByMilestone']>
): AutofixOverviewResponse => ({
  runsByMilestone: {...emptyMilestones, ...partial},
  truncatedMilestones: [],
});

describe('MilestoneToast', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/2/autofix/repos/',
      body: {repos: [{has_write_access: true, integration_id: 5}]},
    });
  });

  it('shows the milestone and the next-action button plus Open Seer', async () => {
    render(<MilestoneToast run={run()} toMilestone="autofix_code_changes" />, {
      organization,
    });

    expect(screen.getByText('SEER-1: Code Generated')).toBeInTheDocument();
    expect(await screen.findByRole('button', {name: 'Draft PR'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Open Seer'})).toBeInTheDocument();
  });

  it('omits the action button when the milestone has no next step', () => {
    render(<MilestoneToast run={run()} toMilestone="pull_requests_merged" />, {
      organization,
    });

    expect(screen.getByText('SEER-1: Merged')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Open Seer'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Draft PR'})).not.toBeInTheDocument();
  });

  it('hides the next-action button while the run is processing', () => {
    render(
      <MilestoneToast
        run={run({status: 'processing'})}
        toMilestone="autofix_code_changes"
      />,
      {organization}
    );

    expect(screen.getByText('SEER-1: Code Generated')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Open Seer'})).toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Draft PR'})).not.toBeInTheDocument();
  });

  it('triggers the next action when its button is clicked', async () => {
    const postRequest = MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/2/autofix/',
      method: 'POST',
      body: {},
    });

    render(<MilestoneToast run={run()} toMilestone="autofix_code_changes" />, {
      organization,
    });

    const button = await screen.findByRole('button', {name: 'Draft PR'});
    await waitFor(() => expect(button).toBeEnabled());
    await userEvent.click(button);

    await waitFor(() =>
      expect(postRequest).toHaveBeenCalledWith(
        '/organizations/org-slug/issues/2/autofix/',
        expect.objectContaining({
          data: expect.objectContaining({step: 'open_pr', sentry_run_id: 'run-1'}),
        })
      )
    );
  });

  it('routes Draft PR to grant permissions when write access is missing', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/2/autofix/repos/',
      body: {repos: [{has_write_access: false, integration_id: 42}]},
    });
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/integrations/42/',
      body: GitHubIntegrationFixture({externalId: '654321', accountType: ''}),
    });

    render(<MilestoneToast run={run()} toMilestone="autofix_code_changes" />, {
      organization,
    });

    const permissionsLink = await screen.findByRole('button', {name: /permissions/i});
    expect(permissionsLink).toHaveAttribute(
      'href',
      expect.stringContaining('/permissions/update')
    );
    expect(screen.queryByRole('button', {name: 'Draft PR'})).not.toBeInTheDocument();
  });
});

describe('useMilestoneAdvanceToasts', () => {
  function Harness({
    data,
    dataSettled = true,
  }: {
    data: AutofixOverviewResponse | undefined;
    dataSettled?: boolean;
  }) {
    useMilestoneAdvanceToasts(data, dataSettled);
    return null;
  }

  it('does not toast on the first payload', () => {
    const addSuccessMessage = jest.spyOn(indicators, 'addSuccessMessage');

    render(<Harness data={response({autofix_root_cause: [run()]})} />, {organization});

    expect(addSuccessMessage).not.toHaveBeenCalled();
  });

  it('toasts once and records analytics when a run advances', () => {
    const addSuccessMessage = jest.spyOn(indicators, 'addSuccessMessage');

    const {rerender} = render(
      <Harness data={response({autofix_root_cause: [run()]})} />,
      {organization}
    );
    rerender(<Harness data={response({autofix_code_changes: [run()]})} />);

    expect(addSuccessMessage).toHaveBeenCalledTimes(1);
    expect(trackAnalytics).toHaveBeenCalledWith(
      'autofix.overview.milestone_advanced',
      expect.objectContaining({
        organization,
        group_id: '2',
        run_id: 'run-1',
        from_milestone: 'autofix_root_cause',
        to_milestone: 'autofix_code_changes',
      })
    );
  });

  it('stays quiet for advances that happened while unmounted', () => {
    const addSuccessMessage = jest.spyOn(indicators, 'addSuccessMessage');

    const {rerender} = render(
      <Harness data={response({autofix_root_cause: [run()]})} dataSettled={false} />,
      {organization}
    );
    rerender(<Harness data={response({autofix_code_changes: [run()]})} dataSettled />);

    expect(addSuccessMessage).not.toHaveBeenCalled();

    rerender(<Harness data={response({has_pull_request: [run()]})} dataSettled />);

    expect(addSuccessMessage).toHaveBeenCalledTimes(1);
  });

  it('does not toast when only the status changes', () => {
    const addSuccessMessage = jest.spyOn(indicators, 'addSuccessMessage');

    const {rerender} = render(
      <Harness data={response({autofix_root_cause: [run({status: 'processing'})]})} />,
      {organization}
    );
    rerender(
      <Harness data={response({autofix_root_cause: [run({status: 'completed'})]})} />
    );

    expect(addSuccessMessage).not.toHaveBeenCalled();
  });
});
