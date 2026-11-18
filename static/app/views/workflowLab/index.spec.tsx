import {OrganizationFixture} from 'sentry-fixture/organization';

import {act, render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {
  InvestigationBlockFixture,
  InvestigationDetailFixture,
} from 'sentry/views/investigations/fixtures';

import WorkflowLab from './';

const organization = OrganizationFixture({
  features: ['investigations'],
  openMembership: true,
});
const url = `/organizations/${organization.slug}/workflow-lab/`;
const runId = '9e71cd2e-9901-4921-8a83-a3e9a61cfabd';
const runUrl = `${url}runs/${runId}/`;
const status = {
  id: runId,
  notebook: true,
  done: false,
  status: 'running',
  notebookId: null,
  nodes: [],
  activity: [],
  usage: {totalTokens: 0, dollarCost: 0, usages: []},
};

beforeEach(() => {
  jest.useFakeTimers();
  MockApiClient.addMockResponse({
    url,
    body: {
      workflow: {notebook: true},
      input: {},
      fixture: {},
      scenarios: {agent: {label: 'Live agent', description: 'Durable run'}},
      skills: {},
      schemas: {},
    },
  });
});

afterEach(async () => {
  try {
    await act(() => jest.runOnlyPendingTimersAsync());
  } finally {
    jest.useRealTimers();
  }
});

it('follows the accepted notebook through its last write using the Explorer chart', async () => {
  MockApiClient.addMockResponse({url, method: 'POST', body: {id: runId, notebook: true}});
  MockApiClient.addMockResponse({url: runUrl, body: status});
  const notebook = InvestigationDetailFixture({
    blocks: [
      InvestigationBlockFixture({
        kind: 'embed',
        embed: {
          name: 'chart',
          body: {
            title: 'Errors by release',
            x_axis: 'category',
            series: [{label: 'Errors', data: [{x: 'v1', y: 5}]}],
          },
        },
        embedSummary: 'Errors peaked on v1.',
      }),
    ],
  });
  const detailUrl = `/organizations/${organization.slug}/notebooks/${notebook.id}/`;
  MockApiClient.addMockResponse({url: detailUrl, body: notebook});
  MockApiClient.addMockResponse({url: detailUrl + 'comments/', body: []});
  MockApiClient.addMockResponse({url: detailUrl + 'comment-counts/', body: {}});
  MockApiClient.addMockResponse({
    url: detailUrl + 'presence/',
    method: 'PUT',
    body: {viewers: [], total: 0, heartbeatIntervalMs: 5000},
  });
  const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
  render(<WorkflowLab />, {organization});
  await user.click(await screen.findByRole('button', {name: 'Run'}));
  await user.click(await screen.findByRole('tab', {name: 'Notebook'}));
  expect(screen.getAllByRole('tab').map(tab => tab.textContent)).toEqual([
    'Activity',
    'Output',
    'Notebook',
    'Run details',
    'Usage',
  ]);
  expect(screen.getByText(/waiting for the notebook agent/i)).toBeInTheDocument();
  MockApiClient.addMockResponse({
    url: runUrl,
    body: {...status, notebookId: notebook.id},
  });
  await act(() => jest.advanceTimersByTimeAsync(2000));
  expect(await screen.findByTestId('seer-chart-content')).toBeInTheDocument();
  expect(screen.getByText('Errors peaked on v1.')).toBeInTheDocument();
  MockApiClient.addMockResponse({
    url: detailUrl,
    body: {...notebook, title: 'Final report'},
  });
  MockApiClient.addMockResponse({
    url: runUrl,
    body: {...status, status: 'succeeded', done: true, notebookId: notebook.id},
  });
  await act(() => jest.advanceTimersByTimeAsync(2000));
  await waitFor(() =>
    expect(screen.getByRole('textbox', {name: 'Investigation title'})).toHaveValue(
      'Final report'
    )
  );
});

it('uses the accepted flag even when the editable draft requests a notebook', async () => {
  MockApiClient.addMockResponse({
    url,
    method: 'POST',
    body: {id: runId, notebook: false},
  });
  MockApiClient.addMockResponse({
    url: runUrl,
    body: {...status, notebook: false, status: 'succeeded', done: true},
  });
  const user = userEvent.setup({advanceTimers: jest.advanceTimersByTime});
  render(<WorkflowLab />, {organization});
  await user.click(await screen.findByRole('button', {name: 'Run'}));
  expect(await screen.findByText('succeeded')).toBeInTheDocument();
  expect(screen.queryByRole('tab', {name: 'Notebook'})).not.toBeInTheDocument();
});
