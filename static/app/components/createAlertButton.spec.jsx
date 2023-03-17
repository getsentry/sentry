import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {navigateTo} from 'sentry/actionCreators/navigation';
import CreateAlertButton, {
  CreateAlertFromViewButton,
} from 'sentry/components/createAlertButton';
import GuideStore from 'sentry/stores/guideStore';
import EventView from 'sentry/utils/discover/eventView';
import {DEFAULT_EVENT_VIEW} from 'sentry/views/discover/data';

const onClickMock = jest.fn();
const context = TestStubs.routerContext();

jest.mock('sentry/actionCreators/navigation');

function renderComponent(organization, eventView) {
  return render(
    <CreateAlertFromViewButton
      location={location}
      organization={organization}
      eventView={eventView}
      projects={[TestStubs.Project()]}
      onClick={onClickMock}
    />,
    {context}
  );
}

function renderSimpleComponent(organization, extraProps) {
  return render(<CreateAlertButton organization={organization} {...extraProps} />, {
    context: TestStubs.routerContext(),
  });
}

describe('CreateAlertFromViewButton', () => {
  const organization = TestStubs.Organization();

  afterEach(() => {
    jest.resetAllMocks();
  });

  it('should trigger onClick callback', async () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      query: 'event.type:error',
      projects: [2],
    });
    renderComponent(organization, eventView);
    await userEvent.click(screen.getByRole('button', {name: 'Create Alert'}));
    expect(onClickMock).toHaveBeenCalledTimes(1);
  });

  it('disables the create alert button for members', () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
    });
    const noAccessOrg = {
      ...organization,
      access: [],
    };

    renderComponent(noAccessOrg, eventView);
    expect(screen.getByRole('button', {name: 'Create Alert'})).toBeDisabled();
  });

  it('shows a guide for members', () => {
    const noAccessOrg = {
      ...organization,
      access: [],
    };

    renderSimpleComponent(noAccessOrg, {
      showPermissionGuide: true,
    });

    expect(GuideStore.state.anchors).toEqual(new Set(['alerts_write_member']));
  });

  it('shows a guide for owners/admins', () => {
    const adminAccessOrg = {
      ...organization,
      access: ['org:write'],
    };

    renderSimpleComponent(adminAccessOrg, {
      showPermissionGuide: true,
    });

    expect(GuideStore.state.anchors).toEqual(new Set(['alerts_write_owner']));
  });

  it('redirects to alert wizard with no project', async () => {
    renderSimpleComponent(organization);
    await userEvent.click(screen.getByRole('button'));
    expect(navigateTo).toHaveBeenCalledWith(
      `/organizations/org-slug/alerts/wizard/?`,
      expect.objectContaining({
        params: {
          orgId: 'org-slug',
        },
      })
    );
  });

  it('redirects to alert wizard with a project', () => {
    renderSimpleComponent(organization, {
      projectSlug: 'proj-slug',
    });

    expect(screen.getByRole('button')).toHaveAttribute(
      'href',
      '/organizations/org-slug/alerts/wizard/?project=proj-slug'
    );
  });

  it('removes a duplicate project filter', async () => {
    const eventView = EventView.fromSavedQuery({
      ...DEFAULT_EVENT_VIEW,
      query: 'event.type:error project:project-slug',
      projects: [2],
    });
    renderComponent(organization, eventView);
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
