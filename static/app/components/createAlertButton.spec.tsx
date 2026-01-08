import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import CreateAlertButton, {
  CreateAlertFromViewButton,
} from 'sentry/components/createAlertButton';
import GuideStore from 'sentry/stores/guideStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import EventView from 'sentry/utils/discover/eventView';
import {DEFAULT_EVENT_VIEW} from 'sentry/views/discover/results/data';

const onClickMock = jest.fn();

describe('CreateAlertFromViewButton', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    ProjectsStore.loadInitialData([]);
  });

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should trigger onClick callback', async () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      query: 'event.type:error',
      projects: [2],
    });
    render(
      <CreateAlertFromViewButton
        organization={organization}
        eventView={eventView}
        projects={[ProjectFixture()]}
        onClick={onClickMock}
      />
    );
    await userEvent.click(screen.getByRole('button', {name: 'Create Alert'}));
    expect(onClickMock).toHaveBeenCalledTimes(1);
  });

  it('disables the button for org-member', () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
    });
    const noAccessOrg = {
      ...organization,
      access: [],
    };
    const projects = [
      {
        ...ProjectFixture(),
        access: [],
      },
    ];
    ProjectsStore.loadInitialData(projects);

    render(
      <CreateAlertFromViewButton
        organization={noAccessOrg}
        eventView={eventView}
        projects={projects}
        onClick={onClickMock}
      />,
      {
        organization: noAccessOrg,
      }
    );

    expect(screen.getByRole('button', {name: 'Create Alert'})).toHaveAttribute(
      'aria-disabled',
      'true'
    );
  });

  it('enables the button for org-owner/manager', () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
    });
    const projects = [
      {
        ...ProjectFixture(),
        access: [],
      },
    ];
    ProjectsStore.loadInitialData(projects);

    render(
      <CreateAlertFromViewButton
        organization={organization}
        eventView={eventView}
        projects={projects}
        onClick={onClickMock}
      />,
      {
        organization,
      }
    );

    expect(screen.getByRole('button', {name: 'Create Alert'})).toBeEnabled();
  });

  it('enables the button for team-admin', () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
    });
    const noAccessOrg = {
      ...organization,
      access: [],
    };
    const projects = [
      {
        ...ProjectFixture(),
        id: '1',
        slug: 'admin-team',
        access: ['alerts:write' as const],
      },
      {
        ...ProjectFixture(),
        id: '2',
        slug: 'contributor-team',
        access: ['alerts:read' as const],
      },
    ];
    ProjectsStore.loadInitialData(projects);

    render(
      <CreateAlertFromViewButton
        organization={noAccessOrg}
        eventView={eventView}
        projects={projects}
        onClick={onClickMock}
      />,
      {
        organization: noAccessOrg,
      }
    );

    expect(screen.getByRole('button', {name: 'Create Alert'})).toBeEnabled();
  });

  it('shows a guide for org-member', () => {
    const noAccessOrg = {
      ...organization,
      access: [],
    };

    render(
      <CreateAlertButton
        aria-label="Create Alert"
        organization={noAccessOrg}
        showPermissionGuide
      />,
      {
        organization: noAccessOrg,
      }
    );

    expect(GuideStore.state.anchors).toEqual(new Set(['alerts_write_member']));
  });

  it('shows a guide for org-owner/manager', () => {
    const adminAccessOrg = OrganizationFixture({
      ...organization,
      access: ['org:write'],
    });

    render(
      <CreateAlertButton
        aria-label="Create Alert"
        organization={adminAccessOrg}
        showPermissionGuide
      />,
      {
        organization: adminAccessOrg,
      }
    );

    expect(GuideStore.state.anchors).toEqual(new Set(['alerts_write_owner']));
  });

  it('redirects to alert wizard with no project', async () => {
    const {router} = render(
      <CreateAlertButton aria-label="Create Alert" organization={organization} />,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/organizations/org-slug/issues/alerts/wizard/',
          },
          route: `/organizations/:orgId/issues/alerts/wizard/`,
        },
      }
    );
    await userEvent.click(screen.getByRole('button'));
    expect(router.location).toEqual(
      expect.objectContaining({
        pathname: `/organizations/org-slug/issues/alerts/wizard/`,
        query: {},
      })
    );
  });

  it('redirects to alert wizard with a project', () => {
    render(
      <CreateAlertButton
        aria-label="Create Alert"
        organization={organization}
        projectSlug="proj-slug"
      />,
      {
        organization,
      }
    );

    expect(screen.getByRole('button')).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/alerts/wizard/?project=proj-slug'
    );
  });

  it('removes a duplicate project filter', async () => {
    const projects = [ProjectFixture()];
    ProjectsStore.loadInitialData(projects);

    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      query: 'event.type:error project:project-slug',
      projects: [2],
    });
    const {router} = render(
      <CreateAlertFromViewButton
        organization={organization}
        eventView={eventView}
        projects={projects}
        onClick={onClickMock}
      />
    );
    await userEvent.click(screen.getByRole('button'));
    expect(router.location).toEqual(
      expect.objectContaining({
        pathname: `/organizations/org-slug/issues/alerts/new/metric/`,
        query: expect.objectContaining({
          query: 'event.type:error ',
          project: 'project-slug',
        }),
      })
    );
  });

  it('shows monitor label and link when workflow engine is enabled', () => {
    const workflowOrg = OrganizationFixture({
      ...organization,
      features: ['workflow-engine-ui'],
    });

    render(<CreateAlertButton organization={workflowOrg} projectSlug="proj-slug" />, {
      organization: workflowOrg,
    });

    const button = screen.getByRole('button', {name: 'Create Monitor'});
    expect(button).toHaveTextContent('Create Monitor');
    expect(button).toHaveAttribute(
      'href',
      '/organizations/org-slug/monitors/new/?project=proj-slug'
    );
  });

  it('deep links to monitor creation from discover when workflow engine is enabled', async () => {
    const workflowOrg = OrganizationFixture({
      ...organization,
      features: ['workflow-engine-ui'],
    });
    const projects = [
      ProjectFixture({
        id: '2',
        slug: 'project-slug',
      }),
    ];
    ProjectsStore.loadInitialData(projects);

    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      query: 'event.type:error',
      projects: [2],
    });
    const {router} = render(
      <CreateAlertFromViewButton
        organization={workflowOrg}
        eventView={eventView}
        projects={projects}
        onClick={onClickMock}
      />,
      {
        organization: workflowOrg,
      }
    );

    await userEvent.click(screen.getByRole('button', {name: 'Create Monitor'}));
    expect(router.location.pathname).toBe(
      '/organizations/org-slug/monitors/new/settings'
    );
    expect(router.location.query).toEqual(
      expect.objectContaining({
        project: '2',
        detectorType: 'metric_issue',
      })
    );
  });
});
