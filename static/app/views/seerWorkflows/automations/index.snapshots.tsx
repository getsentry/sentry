import {MetricDetectorFixture} from 'sentry-fixture/detectors';
import {ProjectFixture} from 'sentry-fixture/project';
import {SeerWorkflowConfigFixture} from 'sentry-fixture/seerWorkflowConfig';
import {UserFixture} from 'sentry-fixture/user';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {User} from 'sentry/types/user';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import AutomationsList, {
  type AutomationConfig,
} from 'sentry/views/seerWorkflows/automations';

import {useFetchConfigs} from './hooks/configs';
import {useMonitorsById} from './hooks/useMonitorsById';
import {
  AutomationSnapshotFrame,
  freezeSnapshotTime,
  makeSnapshotQueryClient,
  SNAPSHOT_TAGS,
  snapshotOrganization,
} from './snapshotTestUtils';

jest.mock('sentry/views/seerWorkflows/automations/hooks/configs');
jest.mock('sentry/views/seerWorkflows/automations/hooks/useMonitorsById');

const creator = UserFixture({id: '7', name: 'Jane Bloggs', email: 'jane@example.com'});

const PROJECTS = [
  ProjectFixture({id: '1', slug: 'frontend', platform: 'javascript-react'}),
  ProjectFixture({id: '2', slug: 'backend', platform: 'python-django'}),
  ProjectFixture({id: '3', slug: 'checkout-service', platform: 'go'}),
  ProjectFixture({id: '4', slug: 'inventory-sync-worker', platform: 'ruby'}),
  ProjectFixture({id: '5', slug: 'mobile-ios', platform: 'apple-ios'}),
];

const MONITORS = new Map(
  ['11', '12', '13', '14', '15', '16', '17'].map(id => [
    id,
    MetricDetectorFixture({id, name: `Checkout latency ${id}`}),
  ])
);

const CONFIGS: Record<string, AutomationConfig[]> = {
  'scheduled-project-scopes': [
    SeerWorkflowConfigFixture({id: '1', projects: [-1]}),
    SeerWorkflowConfigFixture({id: '2', projects: []}),
    SeerWorkflowConfigFixture({id: '3', projects: [1]}),
    SeerWorkflowConfigFixture({id: '4', projects: [1, 2, 3, 4, 5]}),
  ],
  'metric-monitor-counts': [
    SeerWorkflowConfigFixture({
      id: '1',
      strategy: 'breached_metric_investigation',
      monitorIds: [],
    }),
    SeerWorkflowConfigFixture({
      id: '2',
      strategy: 'breached_metric_investigation',
      monitorIds: [11],
    }),
    SeerWorkflowConfigFixture({
      id: '3',
      strategy: 'breached_metric_investigation',
      monitorIds: [11, 12, 13, 14, 15, 16, 17],
    }),
  ],
  'paused-and-ownership': [
    SeerWorkflowConfigFixture({id: '1', enabled: false, projects: [-1]}),
    SeerWorkflowConfigFixture({
      id: '2',
      strategy: 'breached_metric_investigation',
      enabled: false,
      monitorIds: [11, 12],
      createdBy: creator.id,
    }),
    SeerWorkflowConfigFixture({
      id: '3',
      strategy: 'breached_metric_investigation',
      monitorIds: [11],
      createdBy: creator.id,
    }),
    SeerWorkflowConfigFixture({id: '4', schedule: 'hourly', projects: [-1]}),
  ],
  'long-and-unknown-content': [
    SeerWorkflowConfigFixture({
      id: '1',
      strategy: 'breached_metric_investigation',
      name: 'Investigate every checkout, payments and inventory metric breach',
      monitorIds: [11, 12],
      createdBy: creator.id,
    }),
    SeerWorkflowConfigFixture({
      id: '2',
      name: 'Averyveryveryverylongautomationnamewithoutanyspacesatallinit',
      projects: [3, 4, 5],
    }),
    SeerWorkflowConfigFixture({id: '3', strategy: 'not_a_known_strategy'}),
    SeerWorkflowConfigFixture({id: '4', strategy: 'duplicate_monitors', projects: [2]}),
  ],
};

function renderList(width: number, result: Partial<ReturnType<typeof useFetchConfigs>>) {
  jest.mocked(useFetchConfigs).mockReturnValue({
    data: undefined,
    isPending: false,
    isLoadingError: false,
    refetch: jest.fn(),
    ...result,
  } as ReturnType<typeof useFetchConfigs>);
  jest
    .mocked(useMonitorsById)
    .mockReturnValue({data: MONITORS} as ReturnType<typeof useMonitorsById>);

  const queryClient = makeSnapshotQueryClient([
    [
      apiOptions.as<User>()('/organizations/$organizationIdOrSlug/users/$userId/', {
        path: {organizationIdOrSlug: snapshotOrganization.slug, userId: 7},
        staleTime: Infinity,
      }).queryKey,
      {json: creator, headers: {}},
    ],
  ]);

  return (
    <AutomationSnapshotFrame width={width} queryClient={queryClient}>
      <AutomationsList />
    </AutomationSnapshotFrame>
  );
}

describe('AutomationsList', () => {
  freezeSnapshotTime();

  beforeAll(() => {
    ProjectsStore.loadInitialData(PROJECTS);
  });

  for (const [name, configs] of Object.entries(CONFIGS)) {
    it.snapshot(name, () => renderList(1280, {data: configs}), {
      viewport: 1280,
      tags: SNAPSHOT_TAGS,
    });
  }

  it.snapshot(
    'long-and-unknown-content',
    () => renderList(360, {data: CONFIGS['long-and-unknown-content']}),
    {viewport: 360, tags: SNAPSHOT_TAGS}
  );
});
