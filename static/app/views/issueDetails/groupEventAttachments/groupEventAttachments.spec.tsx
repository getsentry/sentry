import {EnvironmentsFixture} from 'sentry-fixture/environments';
import {EventAttachmentFixture} from 'sentry-fixture/eventAttachment';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {TagsFixture} from 'sentry-fixture/tags';
import {UserFixture} from 'sentry-fixture/user';

import {
  act,
  render,
  renderGlobalModal,
  screen,
  userEvent,
  within,
  type RouterConfig,
} from 'sentry-test/reactTestingLibrary';

import ConfigStore from 'sentry/stores/configStore';
import GroupStore from 'sentry/stores/groupStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {Project} from 'sentry/types/project';

import GroupEventAttachments from './groupEventAttachments';

describe('GroupEventAttachments', () => {
  const groupId = 'group-id';
  const group = GroupFixture({id: groupId});
  const organization = OrganizationFixture({
    features: ['event-attachments'],
    orgRole: 'member',
    attachmentsRole: 'member',
  });
  const initialRouterConfig: RouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/issues/${groupId}/attachments/`,
    },
    route: `/organizations/:orgId/issues/:groupId/attachments/`,
  };
  const screenshotRouterConfig: RouterConfig = {
    location: {
      pathname: `/organizations/${organization.slug}/issues/${groupId}/attachments/`,
      query: {attachmentFilter: 'screenshot'},
    },
    route: `/organizations/:orgId/issues/:groupId/attachments/`,
  };
  let project: Project;
  let getAttachmentsMock: jest.Mock;

  beforeEach(() => {
    project = ProjectFixture({platform: 'apple-ios'});
    ProjectsStore.loadInitialData([project]);
    GroupStore.init();

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/environments/`,
      body: EnvironmentsFixture(),
    });
    getAttachmentsMock = MockApiClient.addMockResponse({
      url: `/organizations/org-slug/issues/${groupId}/attachments/`,
      body: [EventAttachmentFixture()],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/tags/`,
      body: TagsFixture(),
      method: 'GET',
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('calls attachments api with screenshot filter', async () => {
    render(<GroupEventAttachments project={project} group={group} />, {
      organization,
      initialRouterConfig: screenshotRouterConfig,
    });
    expect(screen.getByRole('radio', {name: 'Screenshots'})).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', {name: 'Screenshots'}));
    expect(getAttachmentsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/issues/group-id/attachments/',
      expect.objectContaining({
        query: {
          screenshot: '1',
          environment: [],
          statsPeriod: '14d',
        },
      })
    );
  });

  it('calls opens modal when clicking on panel body', async () => {
    render(<GroupEventAttachments project={project} group={group} />, {
      organization,
      initialRouterConfig: screenshotRouterConfig,
    });
    renderGlobalModal();
    await userEvent.click(await screen.findByTestId('screenshot-1'));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
  });

  it('links event id to event detail', async () => {
    render(<GroupEventAttachments project={project} group={group} />, {
      organization,
      initialRouterConfig,
    });
    expect(await screen.findByRole('link', {name: '12345678'})).toHaveAttribute(
      'href',
      '/organizations/org-slug/issues/group-id/events/12345678901234567890123456789012/'
    );
  });

  it('links to the download URL', async () => {
    render(<GroupEventAttachments project={project} group={group} />, {
      organization,
      initialRouterConfig: screenshotRouterConfig,
    });
    await userEvent.click(await screen.findByLabelText('Actions'));
    expect(
      await screen.findByRole('menuitemradio', {name: 'Download'})
    ).toBeInTheDocument();
  });

  it('displays error message when request fails', async () => {
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/issues/group-id/attachments/',
      statusCode: 500,
    });
    render(<GroupEventAttachments project={project} group={group} />, {
      organization,
      initialRouterConfig,
    });
    expect(await screen.findByText(/error loading/i)).toBeInTheDocument();
  });

  it('can delete an attachment', async () => {
    const deleteMock = MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/events/12345678901234567890123456789012/attachments/1/',
      method: 'DELETE',
    });
    render(<GroupEventAttachments project={project} group={group} />, {
      organization,
      initialRouterConfig,
    });
    renderGlobalModal();

    expect(await screen.findByText('12345678')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Delete'})).toBeEnabled();
    await userEvent.click(screen.getByRole('button', {name: 'Delete'}));

    expect(
      await screen.findByText('Are you sure you wish to delete this file?')
    ).toBeInTheDocument();
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {name: 'Delete'})
    );

    expect(deleteMock).toHaveBeenCalled();
    expect(screen.queryByText('12345678')).not.toBeInTheDocument();
  });

  it('filters by date/query when using Streamlined UI', () => {
    ConfigStore.init();
    const user = UserFixture();
    user.options.prefersIssueDetailsStreamlinedUI = true;
    act(() => ConfigStore.set('user', user));

    render(<GroupEventAttachments project={project} group={group} />, {
      initialRouterConfig: {
        location: {
          pathname: `/organizations/${organization.slug}/issues/${groupId}/attachments/`,
          query: {
            statsPeriod: '3d',
            query: 'user.email:leander.rodrigues@sentry.io',
            environment: ['staging'],
          },
        },
        route: `/organizations/:orgId/issues/:groupId/attachments/`,
      },
      organization,
    });
    expect(getAttachmentsMock).toHaveBeenCalledWith(
      '/organizations/org-slug/issues/group-id/attachments/',
      expect.objectContaining({
        query: {
          environment: ['staging'],
          query: 'user.email:leander.rodrigues@sentry.io',
          statsPeriod: '3d',
        },
      })
    );
  });
});
