import {SeerWorkflowConfigFixture} from 'sentry-fixture/seerWorkflowConfig';
import {UserFixture} from 'sentry-fixture/user';

import type {User} from 'sentry/types/user';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {useFetchConfigs} from 'sentry/views/seerWorkflows/automations/hooks/configs';
import {
  AutomationSnapshotFrame,
  freezeSnapshotTime,
  makeSnapshotQueryClient,
  minutesAgo,
  SNAPSHOT_TAGS,
  snapshotOrganization,
} from 'sentry/views/seerWorkflows/automations/snapshotTestUtils';
import type {SeerWorkflowConfigResponse} from 'sentry/views/seerWorkflows/types';

import AutomationDetail from '.';

jest.mock('sentry/views/seerWorkflows/automations/hooks/configs', () => ({
  ...jest.requireActual('sentry/views/seerWorkflows/automations/hooks/configs'),
  useFetchConfigs: jest.fn(),
}));
// The markdown renderer touches `document` on import, which SSR does not have.
jest.mock('@sentry/scraps/markdown', () => ({}));

const editor = UserFixture({id: '7', name: 'Jane Bloggs', email: 'jane@example.com'});

const LONG_NAME_CONFIG = SeerWorkflowConfigFixture({
  id: '7',
  strategy: 'breached_metric_investigation',
  name: 'Investigate every checkout, payments and inventory metric breach',
  monitorIds: [1, 2, 3, 4, 5, 6, 7],
  dateLastRun: minutesAgo(60 * 24 * 12),
  updatedBy: editor.id,
});

const CONFIGS: Record<string, SeerWorkflowConfigResponse> = {
  'scheduled-active': SeerWorkflowConfigFixture({
    id: '7',
    projects: [-1],
    dateLastRun: minutesAgo(90),
  }),
  'scheduled-paused-never-run': SeerWorkflowConfigFixture({
    id: '7',
    enabled: false,
    projects: [1, 2, 3],
  }),
  'metric-active-updated-by-user': SeerWorkflowConfigFixture({
    id: '7',
    strategy: 'breached_metric_investigation',
    name: 'Checkout health',
    monitorIds: [1, 2],
    dateLastRun: minutesAgo(5),
    createdBy: '3',
    updatedBy: editor.id,
  }),
  'long-name': LONG_NAME_CONFIG,
  'unknown-strategy-and-user': SeerWorkflowConfigFixture({
    id: '7',
    strategy: 'not_a_known_strategy',
    schedule: 'hourly',
    createdBy: '424242',
  }),
};

function renderDetail(
  width: number,
  result: Partial<ReturnType<typeof useFetchConfigs>>
) {
  jest.mocked(useFetchConfigs).mockReturnValue({
    data: undefined,
    isPending: false,
    isError: false,
    refetch: jest.fn(),
    ...result,
  } as ReturnType<typeof useFetchConfigs>);

  const queryClient = makeSnapshotQueryClient([
    [
      apiOptions.as<User>()('/organizations/$organizationIdOrSlug/users/$userId/', {
        path: {organizationIdOrSlug: snapshotOrganization.slug, userId: 7},
        staleTime: Infinity,
      }).queryKey,
      {json: editor, headers: {}},
    ],
  ]);

  return (
    <AutomationSnapshotFrame
      width={width}
      queryClient={queryClient}
      route={{
        path: '/organizations/:orgId/seer/automations/:automationId/*',
        location: '/organizations/org-slug/seer/automations/7/',
      }}
    >
      <AutomationDetail />
    </AutomationSnapshotFrame>
  );
}

describe('AutomationDetail', () => {
  freezeSnapshotTime();

  const wide = {viewport: 1200, tags: SNAPSHOT_TAGS};

  for (const [name, config] of Object.entries(CONFIGS)) {
    it.snapshot(name, () => renderDetail(1200, {data: [config]}), wide);
  }

  it.snapshot('long-name', () => renderDetail(520, {data: [LONG_NAME_CONFIG]}), {
    viewport: 520,
    tags: SNAPSHOT_TAGS,
  });
});
