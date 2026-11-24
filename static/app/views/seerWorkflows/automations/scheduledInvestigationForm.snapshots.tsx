import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {SeerWorkflowConfigFixture} from 'sentry-fixture/seerWorkflowConfig';

import type {SeerWorkflowConfigResponse} from 'sentry/views/seerWorkflows/types';

import {ScheduledInvestigationForm} from './scheduledInvestigationForm';
import {
  AutomationSnapshotFrame,
  freezeSnapshotTime,
  loadSnapshotProjects,
  SNAPSHOT_TAGS,
  snapshotOrganization,
} from './snapshotTestUtils';

// Under SSR a nested query container never measures itself and reports zero width.
// Let it inherit the width the snapshot frame provides instead.
jest.mock('@sentry/scraps/layout/styles', () => ({
  ...jest.requireActual('@sentry/scraps/layout/styles'),
  ContainerQueryProvider: ({children}: {children: React.ReactNode}) => children,
}));

const READ_SCOPES = [
  'event:read',
  'member:read',
  'org:read',
  'project:read',
  'team:read',
];

// Owners can scope an automation to all projects, which is the default for them
const ownerOrganization = OrganizationFixture({
  features: snapshotOrganization.features,
  access: snapshotOrganization.access,
  orgRole: 'owner',
});

function makeConfig(params: Partial<SeerWorkflowConfigResponse> = {}) {
  return SeerWorkflowConfigFixture({
    id: '7',
    strategy: 'scheduled_investigation',
    name: 'Checkout investigation',
    projects: [1, 2],
    environments: ['production'],
    serviceAccount: {
      serviceAccountId: '99',
      allProjects: false,
      projectIds: [1, 2, 3],
      scopes: READ_SCOPES,
    },
    ...params,
  });
}

function renderEdit(
  width: number,
  {
    config = makeConfig(),
    readOnly = true,
  }: {config?: SeerWorkflowConfigResponse; readOnly?: boolean} = {}
) {
  return (
    <AutomationSnapshotFrame width={width}>
      <ScheduledInvestigationForm
        mode="edit"
        config={config}
        formId="automation-config-7"
        formRef={{current: null}}
        name={config.name ?? ''}
        onSaved={() => {}}
        readOnly={readOnly}
        setFormHasChanges={() => {}}
      />
    </AutomationSnapshotFrame>
  );
}

describe('ScheduledInvestigationForm', () => {
  freezeSnapshotTime();

  loadSnapshotProjects([
    ProjectFixture({id: '1', slug: 'frontend', platform: 'javascript-react'}),
    ProjectFixture({id: '2', slug: 'backend', platform: 'python-django'}),
    ProjectFixture({id: '3', slug: 'checkout-service', platform: 'go'}),
  ]);

  const wide = {viewport: 1024, tags: SNAPSHOT_TAGS};

  // Without all-project access the scope starts on the user's first project
  it.snapshot(
    'create',
    () => (
      <AutomationSnapshotFrame width={1024}>
        <ScheduledInvestigationForm mode="create" />
      </AutomationSnapshotFrame>
    ),
    wide
  );

  it.snapshot(
    'create-all-projects',
    () => (
      <AutomationSnapshotFrame width={1024} organization={ownerOrganization}>
        <ScheduledInvestigationForm mode="create" />
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
    'edit-all-projects',
    () => renderEdit(1024, {config: makeConfig({projects: [-1]})}),
    wide
  );
});
