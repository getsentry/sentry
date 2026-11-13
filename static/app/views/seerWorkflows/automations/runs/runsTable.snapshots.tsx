import {ProjectFixture} from 'sentry-fixture/project';

import {ProjectsStore} from 'sentry/stores/projectsStore';
import {useAutomationRuns} from 'sentry/views/seerWorkflows/automations/hooks/useAutomationRuns';
import {
  AutomationSnapshotFrame,
  freezeSnapshotTime,
  minutesAgo,
  SNAPSHOT_TAGS,
} from 'sentry/views/seerWorkflows/automations/snapshotTestUtils';
import type {SeerAutomationRun} from 'sentry/views/seerWorkflows/types';

import {RunsTable} from './runsTable';

jest.mock('sentry/views/seerWorkflows/automations/hooks/useAutomationRuns');
// The markdown renderer touches `document` on import, which SSR does not have.
jest.mock('@sentry/scraps/markdown', () => ({}));
// Hovercard portals to document.body, which SSR does not have.
jest.mock('sentry/components/hovercard', () => ({
  Hovercard: ({children}: {children: React.ReactNode}) => children,
}));

type Execution = SeerAutomationRun['executions'][number];
type MonitorTrigger = Extract<SeerAutomationRun['trigger'], {type: 'monitor'}>;

function makeRun(overrides: Partial<SeerAutomationRun> = {}): SeerAutomationRun {
  return {
    id: '1',
    configId: '1',
    configName: null,
    strategy: 'breached_metric_investigation',
    dateAdded: minutesAgo(125),
    dateUpdated: minutesAgo(120),
    dateCompleted: minutesAgo(120),
    executions: [],
    status: 'complete',
    trigger: null,
    ...overrides,
  } as SeerAutomationRun;
}

function makeExecution(overrides: Partial<Execution> = {}): Execution {
  return {
    id: '1',
    seerRunId: null,
    dateAdded: minutesAgo(125),
    dateUpdated: minutesAgo(120),
    dateCompleted: minutesAgo(120),
    outputs: [],
    status: 'complete',
    ...overrides,
  } as Execution;
}

function makeInvestigation(id: string, title: string) {
  return {type: 'investigation', id, title} as const;
}

function makeMonitorTrigger(overrides: Partial<MonitorTrigger> = {}): MonitorTrigger {
  return {
    detectorId: '5',
    detectorName: 'Checkout latency',
    environment: 'production',
    eventId: 'abc',
    groupExists: true,
    groupId: '4388',
    groupShortId: 'CHECKOUT-1A2',
    observedAt: minutesAgo(125),
    occurrenceId: 'def',
    projectId: '2',
    type: 'monitor',
    ...overrides,
  };
}

const LONG_TITLE =
  'Checkout p95 latency regression caused by an unindexed lookup on the orders table after the inventory service deploy';

const STATUS_RUNS: SeerAutomationRun[] = [
  makeRun({
    id: '108',
    status: 'running',
    dateAdded: minutesAgo(3),
    dateCompleted: null,
    trigger: makeMonitorTrigger(),
  }),
  makeRun({
    id: '107',
    status: 'queued',
    dateAdded: minutesAgo(1),
    dateCompleted: null,
    trigger: {type: 'cron'},
  }),
  makeRun({
    id: '106',
    configName: 'Checkout health',
    trigger: makeMonitorTrigger(),
    executions: [
      makeExecution({
        outputs: [makeInvestigation('41', 'Checkout latency spike after deploy')],
      }),
    ],
  }),
  makeRun({
    id: '105',
    status: 'failed',
    error: {code: 'internal_error', message: 'Seer could not reach the repository.'},
    trigger: makeMonitorTrigger(),
  }),
  makeRun({
    id: '104',
    status: 'failed',
    error: null,
    trigger: makeMonitorTrigger(),
    executions: [
      makeExecution({
        id: '1',
        outputs: [makeInvestigation('40', 'Payment webhook failures')],
      }),
      makeExecution({
        id: '2',
        status: 'failed',
        error: {code: 'timeout', message: 'Investigation timed out.'},
      }),
    ],
  }),
  makeRun({
    id: '103',
    status: 'rejected',
    error: {code: 'rate_limited', message: 'Skipped: daily investigation limit reached.'},
    trigger: makeMonitorTrigger(),
  }),
  makeRun({id: '102', status: null, dateCompleted: null}),
];

const TRIGGER_RUNS: SeerAutomationRun[] = [
  makeRun({id: '206', trigger: makeMonitorTrigger()}),
  makeRun({
    id: '205',
    trigger: makeMonitorTrigger({detectorName: null, environment: null}),
  }),
  makeRun({
    id: '204',
    trigger: makeMonitorTrigger({groupExists: false, groupShortId: null}),
  }),
  makeRun({
    id: '203',
    trigger: makeMonitorTrigger({projectId: '999'}),
  }),
  makeRun({id: '202', strategy: 'agentic_triage_v2', trigger: {type: 'cron'}}),
  makeRun({
    id: '201',
    trigger: {type: 'manual_backfill'} as unknown as SeerAutomationRun['trigger'],
  }),
  makeRun({id: '200', strategy: 'not_a_known_strategy', trigger: null}),
];

const OVERFLOW_RUNS: SeerAutomationRun[] = [
  makeRun({
    id: '306',
    configName:
      'Investigate every checkout, payments and inventory metric breach in production',
    trigger: makeMonitorTrigger({
      detectorName:
        'Checkout p95 latency above 2 seconds for the web and mobile storefronts',
      environment: 'production-us-east-1-canary',
      groupShortId: 'STOREFRONT-CHECKOUT-BACKEND-4F9Q',
    }),
    executions: [makeExecution({outputs: [makeInvestigation('1042', LONG_TITLE)]})],
  }),
  makeRun({
    id: '305',
    trigger: makeMonitorTrigger(),
    executions: [
      makeExecution({
        outputs: [
          makeInvestigation('51', 'Checkout latency spike'),
          makeInvestigation('52', 'Payment webhook failures'),
          makeInvestigation('53', 'Inventory sync lag'),
        ],
      }),
    ],
  }),
  makeRun({
    id: '304',
    trigger: makeMonitorTrigger(),
    executions: [
      makeExecution({
        outputs: [
          {type: 'report', id: '12', title: 'Weekly report'},
        ] as unknown as Execution['outputs'],
      }),
    ],
  }),
  makeRun({
    id: '303',
    status: 'failed',
    error: {
      code: 'internal_error',
      message:
        'Seer could not finish the investigation because the repository connection for getsentry/storefront-checkout-service was revoked while the run was in progress.',
    },
    trigger: makeMonitorTrigger(),
  }),
  makeRun({
    id: '1234567',
    dateAdded: minutesAgo(60 * 24 * 40),
    dateCompleted: minutesAgo(60 * 24 * 40 - 190),
    trigger: {type: 'cron'},
  }),
];

function renderRunsTable(
  width: number,
  result: Partial<ReturnType<typeof useAutomationRuns>>,
  props: React.ComponentProps<typeof RunsTable> = {}
) {
  jest.mocked(useAutomationRuns).mockReturnValue({
    runs: [],
    pageLinks: undefined,
    isPending: false,
    isLoadingError: false,
    refetch: jest.fn(),
    ...result,
  });

  return (
    <AutomationSnapshotFrame width={width}>
      <RunsTable {...props} />
    </AutomationSnapshotFrame>
  );
}

describe('RunsTable', () => {
  freezeSnapshotTime();

  beforeAll(() => {
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '2', slug: 'storefront', platform: 'javascript-react'}),
    ]);
  });

  const wide = {viewport: 1200, tags: SNAPSHOT_TAGS};

  it.snapshot('statuses', () => renderRunsTable(1200, {runs: STATUS_RUNS}), wide);

  it.snapshot('triggers', () => renderRunsTable(1200, {runs: TRIGGER_RUNS}), wide);

  for (const viewport of [1200, 700, 400]) {
    it.snapshot(
      'overflowing-content',
      () => renderRunsTable(viewport, {runs: OVERFLOW_RUNS}),
      {viewport, tags: SNAPSHOT_TAGS}
    );
  }

  it.snapshot(
    'single-automation',
    () =>
      renderRunsTable(1200, {runs: STATUS_RUNS}, {configId: '1', showStrategy: false}),
    wide
  );

  it.snapshot('empty', () => renderRunsTable(1200, {runs: []}), wide);
});
