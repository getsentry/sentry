import {
  ActionFilterFixture,
  ActionFixture,
  AutomationFixture,
} from 'sentry-fixture/automations';
import {MetricDetectorFixture} from 'sentry-fixture/detectors';
import {SimpleGroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';

import {Button} from '@sentry/scraps/button';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {GroupStatus} from 'sentry/types/group';
import {ActionType} from 'sentry/types/workflowEngine/actions';
import type {Automation} from 'sentry/types/workflowEngine/automations';
import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import {automationsApiOptions} from 'sentry/views/automations/hooks';

import {MonitorTable} from './monitorTable';
import {
  AutomationSnapshotFrame,
  freezeSnapshotTime,
  makeSnapshotQueryClient,
  minutesAgo,
  SNAPSHOT_TAGS,
  snapshotOrganization,
} from './snapshotTestUtils';

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

function makeAlert(
  id: string,
  detectorIds: string[],
  targets: Array<[type: ActionType, targetDisplay: string | null]>,
  params: Partial<Automation> = {}
) {
  return AutomationFixture({
    id,
    detectorIds,
    actionFilters: [
      ActionFilterFixture({
        actions: targets.map(([type, targetDisplay], index) => {
          const action = ActionFixture({id: `${id}-${index}`, type});
          return {...action, config: {...action.config, targetDisplay}};
        }),
      }),
    ],
    ...params,
  });
}

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
    latestGroup: SimpleGroupFixture({
      id: '102',
      status: GroupStatus.RESOLVED,
      lastSeen: minutesAgo(60 * 24 * 3),
    }),
  }),
  MetricDetectorFixture({
    id: '3',
    name: 'Checkout p95 latency above 2 seconds for the web and mobile storefronts in every region',
    projectId: '1',
    latestGroup: null,
  }),
  MetricDetectorFixture({
    id: '4',
    name: 'Inventory sync lag',
    projectId: '2',
    latestGroup: SimpleGroupFixture({
      id: '104',
      status: GroupStatus.UNRESOLVED,
      lastSeen: minutesAgo(60 * 24 * 45),
    }),
  }),
];

const ALERTS = [
  makeAlert('1', ['1'], [[ActionType.SLACK, '#checkout-alerts']]),
  makeAlert(
    '2',
    ['2', '3'],
    [
      [ActionType.SLACK, '#payments-oncall-escalations-production'],
      [ActionType.EMAIL, null],
      [ActionType.PAGERDUTY, 'Payments'],
      [ActionType.DISCORD, '#incidents'],
    ]
  ),
  makeAlert('3', ['4'], [[ActionType.SLACK, '#disabled']], {enabled: false}),
];

function renderTable(
  width: number,
  props: Partial<React.ComponentProps<typeof MonitorTable>>
) {
  const monitors = props.monitors ?? [];
  const queryClient = makeSnapshotQueryClient([
    [
      automationsApiOptions(snapshotOrganization, {
        detector: monitors.map(monitor => monitor.id).toSorted(),
        limit: 100,
      }).queryKey,
      {json: ALERTS, headers: {}},
    ],
  ]);

  return (
    <AutomationSnapshotFrame width={width} queryClient={queryClient}>
      <MonitorTable
        monitors={monitors}
        renderAction={() => <Button size="sm">Disconnect</Button>}
        {...props}
      />
    </AutomationSnapshotFrame>
  );
}

describe('MonitorTable', () => {
  freezeSnapshotTime();

  beforeAll(() => {
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '1', slug: 'frontend', platform: 'javascript-react'}),
      ProjectFixture({id: '2', slug: 'backend', platform: 'python-django'}),
    ]);
  });

  for (const viewport of [960, 600, 400]) {
    it.snapshot('monitors', () => renderTable(viewport, {monitors: MONITORS}), {
      viewport,
      tags: SNAPSHOT_TAGS,
    });
  }

  const wide = {viewport: 960, tags: SNAPSHOT_TAGS};

  it.snapshot('pending-rows', () => renderTable(960, {pendingRows: 3}), wide);

  it.snapshot('empty', () => renderTable(960, {}), wide);
});
