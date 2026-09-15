import {
  getGcpErrorGroups,
  getGcpProjectResults,
  getStatusLabel,
  getStatusVariant,
  type GcpProjectResult,
} from 'sentry/utils/seer/gcpConnection';

function project(overrides: Partial<GcpProjectResult> = {}): GcpProjectResult {
  return {
    gcpProjectId: 'project-a',
    connectionStatus: 'permission_denied',
    services: [
      {service: 'logging', status: 'permission_denied', errorDetail: 'Check access.'},
    ],
    ...overrides,
  };
}

describe('getGcpErrorGroups', () => {
  it('groups equivalent errors across projects and sorts and deduplicates services', () => {
    const services = ['cloudtrace', 'logging', 'monitoring', 'logging'].map(service => ({
      service,
      status: 'permission_denied',
      errorDetail: ' Check access. ',
    }));
    const groups = getGcpErrorGroups({
      connectionStatus: 'permission_denied',
      projects: [project({services}), project({gcpProjectId: 'project-b'})],
    });
    expect(groups).toEqual([
      {
        key: expect.any(String),
        status: 'permission_denied',
        detail: 'Check access.',
        projects: [
          {gcpProjectId: 'project-a', services: ['logging', 'monitoring', 'cloudtrace']},
          {gcpProjectId: 'project-b', services: ['logging']},
        ],
      },
    ]);
  });

  it('keeps different explanations and statuses separate, even on the same project', () => {
    const groups = getGcpErrorGroups({
      connectionStatus: 'permission_denied',
      projects: [
        project({
          services: [
            {service: 'logging', status: 'connected'},
            {
              service: 'monitoring',
              status: 'api_disabled',
              errorDetail: 'Enable the API.',
            },
            {
              service: 'cloudtrace',
              status: 'permission_denied',
              errorDetail: 'Check access.',
            },
            {service: 'new-service', status: 'error', errorDetail: 'Check access.'},
            {
              service: 'another-service',
              status: 'permission_denied',
              errorDetail: 'Check impersonation.',
            },
          ],
        }),
      ],
    });
    expect(
      groups.map(({status, detail, projects}) => ({status, detail, projects}))
    ).toEqual([
      {
        status: 'api_disabled',
        detail: 'Enable the API.',
        projects: [{gcpProjectId: 'project-a', services: ['monitoring']}],
      },
      {
        status: 'permission_denied',
        detail: 'Check access.',
        projects: [{gcpProjectId: 'project-a', services: ['cloudtrace']}],
      },
      {
        status: 'error',
        detail: 'Check access.',
        projects: [{gcpProjectId: 'project-a', services: ['new-service']}],
      },
      {
        status: 'permission_denied',
        detail: 'Check impersonation.',
        projects: [{gcpProjectId: 'project-a', services: ['another-service']}],
      },
    ]);
  });

  it('shows a shared authentication error once without losing affected projects', () => {
    const groups = getGcpErrorGroups({
      connectionStatus: 'permission_denied',
      errorDetail: 'Check access.',
      projects: [
        project({errorDetail: 'Check access.'}),
        project({gcpProjectId: 'project-b', errorDetail: 'Check access.'}),
      ],
    });
    expect(groups).toHaveLength(1);
    expect(groups[0]!.projects).toHaveLength(2);
  });

  it('preserves distinct project and overall errors alongside service errors', () => {
    const groups = getGcpErrorGroups({
      connectionStatus: 'error',
      errorDetail: 'Some checks failed.',
      projects: [project({errorDetail: 'Check the project setup.'})],
    });
    expect(groups.map(group => group.detail)).toEqual([
      'Check access.',
      'Check the project setup.',
      'Some checks failed.',
    ]);
    expect(groups[1]!.projects).toEqual([{gcpProjectId: 'project-a', services: []}]);
  });

  it('only deduplicates a project error when its status and explanation both match', () => {
    const groups = getGcpErrorGroups({
      connectionStatus: 'permission_denied',
      errorDetail: 'Check configuration.',
      projects: [
        project({
          errorDetail: 'Check configuration.',
          services: [
            {service: 'logging', status: 'error', errorDetail: 'Check configuration.'},
            {
              service: 'monitoring',
              status: 'permission_denied',
              errorDetail: 'Check project access.',
            },
          ],
        }),
      ],
    });
    expect(groups).toHaveLength(3);
    expect(groups[2]).toEqual(
      expect.objectContaining({
        status: 'permission_denied',
        detail: 'Check configuration.',
        projects: [{gcpProjectId: 'project-a', services: []}],
      })
    );
  });

  it('excludes healthy and unverified projects from errors', () => {
    const groups = getGcpErrorGroups({
      connectionStatus: 'permission_denied',
      projects: [
        project(),
        project({gcpProjectId: 'healthy', connectionStatus: 'connected'}),
        project({gcpProjectId: 'unchecked', connectionStatus: 'unverified'}),
      ],
    });
    expect(groups[0]!.projects).toEqual([
      {gcpProjectId: 'project-a', services: ['logging']},
    ]);
  });

  it.each([null, undefined, '   '])(
    'provides guidance for missing or blank service details (%s)',
    errorDetail => {
      const groups = getGcpErrorGroups({
        connectionStatus: 'permission_denied',
        projects: [
          project({
            services: [{service: 'logging', status: 'permission_denied', errorDetail}],
          }),
        ],
      });
      expect(groups[0]!.detail).toContain('The project may not exist');
    }
  );

  it('shows project-only failures and gives unknown statuses a safe fallback', () => {
    const groups = getGcpErrorGroups({
      connectionStatus: 'new_status',
      projects: [
        project({connectionStatus: 'new_status', services: []}),
        project({
          gcpProjectId: 'project-b',
          services: [],
          errorDetail: 'Verification did not run.',
        }),
      ],
    });
    expect(groups.map(group => group.detail)).toEqual([
      "Sentry couldn't complete verification. Re-test the connection.",
      'Verification did not run.',
    ]);
    expect(getStatusLabel('toString')).toBe('Error');
    expect(getStatusVariant('toString')).toBe('danger');
  });

  it('displays an overall failure even when no project results are available', () => {
    expect(getGcpErrorGroups({connectionStatus: 'error', projects: []})[0]!.detail).toBe(
      "Sentry couldn't complete verification. Re-test the connection."
    );
  });
});

it('converts saved service and project details for display', () => {
  expect(
    getGcpProjectResults([
      {
        gcp_project_id: 'project-a',
        connection_status: 'permission_denied',
        error_detail: null,
        services: [
          {
            service: 'logging',
            status: 'permission_denied',
            error_detail: 'Check access.',
          },
        ],
      },
    ])
  ).toEqual([project({errorDetail: null})]);
});
