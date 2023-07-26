import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {navigateTo} from 'sentry/actionCreators/navigation';
import CreateAlertButton, {
  CreateAlertFromViewButton,
} from 'sentry/components/createAlertButton';
import GuideStore from 'sentry/stores/guideStore';
import EventView from 'sentry/utils/discover/eventView';
import {DEFAULT_EVENT_VIEW} from 'sentry/views/discover/data';

const onClickMock = jest.fn();

jest.mock('sentry/actionCreators/navigation');

describe('CreateAlertFromViewButton', () => {
  const organization = TestStubs.Organization();

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should trigger onClick callback', async () => {
    const context = TestStubs.routerContext();

    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      query: 'event.type:error',
      projects: [2],
    });
    render(
      <CreateAlertFromViewButton
        organization={organization}
        eventView={eventView}
        projects={[TestStubs.Project()]}
        onClick={onClickMock}
      />,
      {context}
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
    const noAccessProj = {
      ...TestStubs.Project(),
      access: [],
    };

    render(
      <CreateAlertFromViewButton
        organization={noAccessOrg}
        eventView={eventView}
        projects={[noAccessProj]}
        onClick={onClickMock}
      />,
      {
        context: TestStubs.routerContext([{organization: noAccessOrg}]),
        organization: noAccessOrg,
      }
    );

    expect(screen.getByRole('button', {name: 'Create Alert'})).toBeDisabled();
  });

  it('enables the button for org-owner/manager', () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
    });
    const noAccessProj = {
      ...TestStubs.Project(),
      access: [],
    };

    render(
      <CreateAlertFromViewButton
        organization={organization}
        eventView={eventView}
        projects={[noAccessProj]}
        onClick={onClickMock}
      />,
      {
        context: TestStubs.routerContext([{organization}]),
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
        ...TestStubs.Project(),
        id: 1,
        slug: 'admin-team',
        access: ['alerts:write'],
      },
      {
        ...TestStubs.Project(),
        id: 2,
        slug: 'contributor-team',
        access: ['alerts:read'],
      },
    ];

    render(
      <CreateAlertFromViewButton
        organization={noAccessOrg}
        eventView={eventView}
        projects={projects}
        onClick={onClickMock}
      />,
      {
        context: TestStubs.routerContext([{organization: noAccessOrg}]),
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

    render(<CreateAlertButton organization={noAccessOrg} showPermissionGuide />, {
      organization: noAccessOrg,
    });

    expect(GuideStore.state.anchors).toEqual(new Set(['alerts_write_member']));
  });

  it('shows a guide for org-owner/manager', () => {
    const adminAccessOrg = {
      ...organization,
      access: ['org:write'],
    };

    render(<CreateAlertButton organization={adminAccessOrg} showPermissionGuide />, {
      organization: adminAccessOrg,
    });

    expect(GuideStore.state.anchors).toEqual(new Set(['alerts_write_owner']));
  });

  it('redirects to alert wizard with no project', async () => {
    render(<CreateAlertButton organization={organization} />, {
      organization,
    });
    await userEvent.click(screen.getByRole('button'));
    expect(navigateTo).toHaveBeenCalledWith(
      `/organizations/org-slug/alerts/wizard/?`,
      expect.objectContaining({
        params: expect.objectContaining({
          orgId: 'org-slug',
        }),
      })
    );
  });

  it('redirects to alert wizard with a project', () => {
    render(<CreateAlertButton organization={organization} projectSlug="proj-slug" />, {
      organization,
    });

    expect(screen.getByRole('button')).toHaveAttribute(
      'href',
      '/organizations/org-slug/alerts/wizard/?project=proj-slug'
    );
  });

  it('removes a duplicate project filter', async () => {
    const context = TestStubs.routerContext();

    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      query: 'event.type:error project:project-slug',
      projects: [2],
    });
    render(
      <CreateAlertFromViewButton
        organization={organization}
        eventView={eventView}
        projects={[TestStubs.Project()]}
        onClick={onClickMock}
      />,
      {context}
    );
    await userEvent.click(screen.getByRole('button'));
    expect(context.context.router.push).toHaveBeenCalledWith({
      pathname: `/organizations/org-slug/alerts/new/metric/`,
      query: expect.objectContaining({
        query: 'event.type:error ',
        project: 'project-slug',
      }),
    });
  });
});
