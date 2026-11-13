import {MetricDetectorFixture} from 'sentry-fixture/detectors';
import {SimpleGroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';
import {SeerWorkflowConfigFixture} from 'sentry-fixture/seerWorkflowConfig';

import {GroupStatus} from 'sentry/types/group';
import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import {automationsApiOptions} from 'sentry/views/automations/hooks';
import {detectorListApiOptions} from 'sentry/views/detectors/hooks';
import type {SeerWorkflowConfigResponse} from 'sentry/views/seerWorkflows/types';

import {MetricAutomationForm} from './metricAutomationForm';
import {
  AutomationSnapshotFrame,
  freezeSnapshotTime,
  loadSnapshotProjects,
  makeSnapshotQueryClient,
  minutesAgo,
  SNAPSHOT_TAGS,
  snapshotOrganization,
} from './snapshotTestUtils';

// Under SSR a nested query container never measures itself and reports zero width.
// Let it inherit the width the snapshot frame provides instead.
jest.mock('@sentry/scraps/layout/styles', () => ({
  ...jest.requireActual('@sentry/scraps/layout/styles'),
  ContainerQueryProvider: ({children}: {children: React.ReactNode}) => children,
}));
// The markdown renderer touches `document` on import, which SSR does not have.
jest.mock('@sentry/scraps/markdown', () => ({}));
// Only shown inside the hovercard, and its imports don't load under SSR.
jest.mock('sentry/views/detectors/components/details/metric/detect', () => ({
  MetricDetectorDetailsDetect: () => null,
}));
// Hovercard portals to document.body, which SSR does not have.
jest.mock('sentry/components/hovercard', () => ({
  Hovercard: ({children}: {children: React.ReactNode}) => children,
}));

const MONITORS: MetricDetector[] = [
  MetricDetectorFixture({
    id: '1',
    name: 'Checkout latency',
    projectId: '1',
    latestGroup: SimpleGroupFixture({
      id: '101',
      status: GroupStatus.UNRESOLVED,
      lastSeen: minutesAgo(12),
    }),
  }),
  MetricDetectorFixture({
    id: '2',
    name: 'Payment failure rate',
    projectId: '2',
    latestGroup: null,
  }),
];

const READ_SCOPES = [
  'event:read',
  'member:read',
  'org:read',
  'project:read',
  'team:read',
];

function makeConfig(params: Partial<SeerWorkflowConfigResponse> = {}) {
  return SeerWorkflowConfigFixture({
    id: '7',
    strategy: 'breached_metric_investigation',
    name: 'Checkout health',
    monitorIds: [1, 2],
    serviceAccount: {
      serviceAccountId: '99',
      allProjects: false,
      projectIds: [1, 2, 3],
      scopes: READ_SCOPES,
    },
    ...params,
  });
}

function makeQueryClient(monitorIds: string[], monitors: 'loaded' | 'pending') {
  if (monitors === 'pending') {
    return makeSnapshotQueryClient();
  }
  return makeSnapshotQueryClient([
    [
      detectorListApiOptions(snapshotOrganization, {
        ids: monitorIds,
        projects: [-1],
        limit: 100,
      }).queryKey,
      {json: MONITORS.filter(monitor => monitorIds.includes(monitor.id)), headers: {}},
    ],
    [
      automationsApiOptions(snapshotOrganization, {
        detector: monitorIds.toSorted(),
        limit: 100,
      }).queryKey,
      {json: [], headers: {}},
    ],
  ]);
}

function renderEdit(
  width: number,
  {
    config = makeConfig(),
    readOnly = true,
    monitors = 'loaded',
  }: {
    config?: SeerWorkflowConfigResponse;
    monitors?: 'loaded' | 'pending';
    readOnly?: boolean;
  } = {}
) {
  return (
    <AutomationSnapshotFrame
      width={width}
      queryClient={makeQueryClient(config.monitorIds.map(String), monitors)}
    >
      <MetricAutomationForm
        mode="edit"
        config={config}
        formId="automation-config-7"
        formRef={{current: null}}
        name={config.name ?? ''}
        onSaved={() => {}}
        readOnly={readOnly}
        setFormHasChanges={() => {}}
        setMonitorsPending={() => {}}
      />
    </AutomationSnapshotFrame>
  );
}

describe('MetricAutomationForm', () => {
  freezeSnapshotTime();

  loadSnapshotProjects([
    ProjectFixture({id: '1', slug: 'frontend', platform: 'javascript-react'}),
    ProjectFixture({id: '2', slug: 'backend', platform: 'python-django'}),
    ProjectFixture({id: '3', slug: 'checkout-service', platform: 'go'}),
  ]);

  const wide = {viewport: 1024, tags: SNAPSHOT_TAGS};

  it.snapshot(
    'create',
    () => (
      <AutomationSnapshotFrame width={1024}>
        <MetricAutomationForm mode="create" />
      </AutomationSnapshotFrame>
    ),
    wide
  );

  it.snapshot('edit-read-only', () => renderEdit(1024), wide);

  it.snapshot('edit-configuring', () => renderEdit(480, {readOnly: false}), {
    viewport: 480,
    tags: SNAPSHOT_TAGS,
  });

  it.snapshot(
    'edit-monitors-loading',
    () => renderEdit(1024, {monitors: 'pending'}),
    wide
  );
});
