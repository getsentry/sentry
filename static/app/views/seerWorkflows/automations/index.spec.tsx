import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {SeerWorkflowConfigFixture} from 'sentry-fixture/seerWorkflowConfig';

import {render, screen, within} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import AutomationsList, {getNextUpdate} from 'sentry/views/seerWorkflows/automations';
import type {SeerWorkflowConfigResponse} from 'sentry/views/seerWorkflows/types';

function getCard(title: string) {
  return within(screen.getByRole('heading', {name: title}).closest('li')!);
}

describe('AutomationsList', () => {
  const organization = OrganizationFixture({features: ['seer-automations']});
  const configsUrl = `/organizations/${organization.slug}/seer/workflows/configs/`;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [],
    });
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '1', slug: 'frontend'}),
      ProjectFixture({id: '2', slug: 'backend'}),
    ]);
  });

  function mockConfigs(configs: SeerWorkflowConfigResponse[]) {
    return MockApiClient.addMockResponse({url: configsUrl, body: {configs}});
  }

  it('renders not found without seer-automations', async () => {
    const request = mockConfigs([SeerWorkflowConfigFixture({id: '1'})]);

    render(<AutomationsList />, {organization: OrganizationFixture()});

    expect(await screen.findByText('Page Not Found')).toBeInTheDocument();
    expect(request).not.toHaveBeenCalled();
  });

  it('renders a card per config after the placeholders', async () => {
    mockConfigs([
      SeerWorkflowConfigFixture({id: '1', strategy: 'agentic_triage'}),
      SeerWorkflowConfigFixture({id: '2', strategy: 'custom_strategy'}),
    ]);

    render(<AutomationsList />, {organization});

    expect(
      await screen.findByRole('heading', {name: 'custom_strategy'})
    ).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    // The agentic_triage placeholder and the agentic_triage config
    expect(screen.getAllByRole('heading', {name: 'Agentic triage'})).toHaveLength(2);
    expect(
      screen.getAllByText('Automatically triage and fix the most fixable Issues.')
    ).toHaveLength(2);
    expect(getCard('custom_strategy').getByText('No description')).toBeInTheDocument();
  });

  it('shows which projects each config covers', async () => {
    mockConfigs([
      SeerWorkflowConfigFixture({id: '1', strategy: 'all_strategy', projects: [-1]}),
      SeerWorkflowConfigFixture({id: '2', strategy: 'none_strategy', projects: []}),
      SeerWorkflowConfigFixture({
        id: '3',
        strategy: 'some_strategy',
        projects: [2, 99, 1],
      }),
    ]);

    render(<AutomationsList />, {organization});

    await screen.findByRole('heading', {name: 'some_strategy'});
    expect(getCard('all_strategy').getByText('All projects')).toBeInTheDocument();
    expect(getCard('none_strategy').getByText('No projects')).toBeInTheDocument();
    expect(getCard('some_strategy').getByText('backend, frontend')).toBeInTheDocument();
  });

  it('shows a next run tag only for daily configs', async () => {
    mockConfigs([
      SeerWorkflowConfigFixture({id: '1', strategy: 'daily_strategy', schedule: 'daily'}),
      SeerWorkflowConfigFixture({
        id: '2',
        strategy: 'weekly_strategy',
        schedule: 'weekly',
      }),
    ]);

    render(<AutomationsList />, {organization});

    await screen.findByRole('heading', {name: 'daily_strategy'});
    expect(getCard('daily_strategy').getByText(/Next run/)).toBeInTheDocument();
    expect(getCard('weekly_strategy').queryByText(/Next run/)).not.toBeInTheDocument();
  });

  it('shows a paused tag in place of the schedule for disabled configs', async () => {
    mockConfigs([
      SeerWorkflowConfigFixture({
        id: '1',
        strategy: 'paused_strategy',
        schedule: 'daily',
        enabled: false,
      }),
    ]);

    render(<AutomationsList />, {organization});

    await screen.findByRole('heading', {name: 'paused_strategy'});
    expect(getCard('paused_strategy').getByText('Paused')).toBeInTheDocument();
    expect(getCard('paused_strategy').queryByText(/Next run/)).not.toBeInTheDocument();
  });
});

describe('getNextUpdate', () => {
  afterEach(() => {
    try {
      jest.runOnlyPendingTimers();
    } finally {
      jest.useRealTimers();
    }
  });

  it('returns undefined for schedules other than daily', () => {
    jest.useFakeTimers({now: new Date('2026-10-23T09:00:00Z')});

    expect(getNextUpdate('weekly')).toBeUndefined();
    expect(getNextUpdate('')).toBeUndefined();
  });

  it.each([
    ['before 10:00', '2026-10-23T09:59:59Z', '2026-10-23T10:00:00.000Z'],
    ['at 10:00', '2026-10-23T10:00:00Z', '2026-10-23T22:00:00.000Z'],
    ['between 10:00 and 22:00', '2026-10-23T15:30:00Z', '2026-10-23T22:00:00.000Z'],
    ['at 22:00', '2026-10-23T22:00:00Z', '2026-10-24T10:00:00.000Z'],
    ['after 22:00', '2026-10-23T23:15:00Z', '2026-10-24T10:00:00.000Z'],
    [
      'after 22:00 at the end of a month',
      '2026-10-31T23:00:00Z',
      '2026-11-01T10:00:00.000Z',
    ],
    [
      'after 22:00 at the end of a year',
      '2026-12-31T23:00:00Z',
      '2027-01-01T10:00:00.000Z',
    ],
  ])('picks the next daily run %s UTC', (_, now, expected) => {
    jest.useFakeTimers({now: new Date(now)});

    expect(getNextUpdate('daily')?.toISOString()).toBe(expected);
  });
});
