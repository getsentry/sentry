import {MetricDetectorFixture} from 'sentry-fixture/detectors';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import type {Scope} from 'sentry/types/core';

import {ServiceAccountPermissions, ServiceAccountProjects} from './serviceAccountAccess';
import {
  AutomationSnapshotFrame,
  loadSnapshotProjects,
  SNAPSHOT_TAGS,
  snapshotOrganization,
} from './snapshotTestUtils';

const WIDTH = 720;
const options = {viewport: WIDTH, tags: SNAPSHOT_TAGS};

const READ_SCOPES: Scope[] = [
  'event:read',
  'member:read',
  'org:read',
  'project:read',
  'team:read',
];

const globalRoleOrganization = OrganizationFixture({
  ...snapshotOrganization,
  orgRole: 'owner',
  access: [...READ_SCOPES, 'event:write', 'event:admin', 'project:write', 'alerts:read'],
});

const MONITORS = [
  MetricDetectorFixture({id: '1', name: 'Checkout latency', projectId: '1'}),
  MetricDetectorFixture({id: '2', name: 'Checkout errors', projectId: '1'}),
  MetricDetectorFixture({id: '3', name: 'Payment failures', projectId: '2'}),
];

function renderProjects(
  props: Partial<React.ComponentProps<typeof ServiceAccountProjects>>,
  organization = snapshotOrganization
) {
  return (
    <AutomationSnapshotFrame width={WIDTH} organization={organization}>
      <ServiceAccountProjects
        value={{allProjects: false, projectIds: []}}
        monitors={[]}
        disabled={false}
        onChange={() => {}}
        {...props}
      />
    </AutomationSnapshotFrame>
  );
}

function renderPermissions(
  props: Partial<React.ComponentProps<typeof ServiceAccountPermissions>>,
  organization = snapshotOrganization
) {
  return (
    <AutomationSnapshotFrame width={WIDTH} organization={organization}>
      <ServiceAccountPermissions
        value={READ_SCOPES}
        disabled={false}
        onChange={() => {}}
        {...props}
      />
    </AutomationSnapshotFrame>
  );
}

describe('ServiceAccountAccess', () => {
  loadSnapshotProjects([
    ProjectFixture({id: '1', slug: 'frontend', platform: 'javascript-react'}),
    ProjectFixture({id: '2', slug: 'backend', platform: 'python-django'}),
    ProjectFixture({
      id: '3',
      slug: 'inventory-sync-worker-for-the-european-warehouses',
      platform: 'go',
    }),
    ProjectFixture({id: '4', slug: 'mobile-ios', platform: 'apple-ios'}),
  ]);

  describe('ServiceAccountProjects', () => {
    it.snapshot('no-projects', () => renderProjects({}), options);

    it.snapshot(
      'monitor-and-manual-projects',
      () =>
        renderProjects({
          monitors: MONITORS,
          value: {allProjects: false, projectIds: ['3', '4']},
        }),
      options
    );

    it.snapshot(
      'monitor-and-manual-projects-read-only',
      () =>
        renderProjects({
          monitors: MONITORS,
          value: {allProjects: false, projectIds: ['3', '4']},
          disabled: true,
        }),
      options
    );

    it.snapshot(
      'all-projects',
      () =>
        renderProjects(
          {monitors: MONITORS, value: {allProjects: true, projectIds: []}},
          globalRoleOrganization
        ),
      options
    );
  });

  describe('ServiceAccountPermissions', () => {
    it.snapshot('default-read-scopes', () => renderPermissions({}), options);

    it.snapshot(
      'write-and-admin-scopes',
      () =>
        renderPermissions(
          {
            value: [
              ...READ_SCOPES,
              'event:write',
              'event:admin',
              'project:write',
              'alerts:read',
            ],
          },
          globalRoleOrganization
        ),
      options
    );
  });
});
