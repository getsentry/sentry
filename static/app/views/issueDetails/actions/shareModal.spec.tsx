import {EventFixture} from 'sentry-fixture/event';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, renderGlobalModal, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import GroupStore from 'sentry/stores/groupStore';
import ModalStore from 'sentry/stores/modalStore';
import ShareIssueModal from 'sentry/views/issueDetails/actions/shareModal';

describe('ShareIssueModal', () => {
  const project = ProjectFixture();
  const organization = OrganizationFixture({features: ['shared-issues']});
  const onToggle = jest.fn();

  beforeEach(() => {
    GroupStore.init();
    Object.assign(navigator, {
      clipboard: {
        writeText: jest.fn().mockResolvedValue(''),
      },
    });
  });
  afterEach(() => {
    ModalStore.reset();
    GroupStore.reset();
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('should copy issue link', async () => {
    const group = GroupFixture({isPublic: true, shareId: '12345'});
    GroupStore.add([group]);

    renderGlobalModal();

    act(() =>
      openModal(modalProps => (
        <ShareIssueModal
          {...modalProps}
          groupId={group.id}
          organization={organization}
          projectSlug={project.slug}
          onToggle={onToggle}
          event={null}
          hasIssueShare
        />
      ))
    );

    expect(screen.getByText('Share Issue')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Copy Link'}));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      `http://localhost/organizations/org-slug/issues/1/`
    );
  });

  it('should copy link with event id', async () => {
    const group = GroupFixture({isPublic: true, shareId: '12345'});
    GroupStore.add([group]);
    const event = EventFixture();

    renderGlobalModal();

    act(() =>
      openModal(modalProps => (
        <ShareIssueModal
          {...modalProps}
          groupId={group.id}
          organization={organization}
          projectSlug={project.slug}
          onToggle={onToggle}
          event={event}
          hasIssueShare
        />
      ))
    );

    expect(screen.getByText('Share Issue')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Copy Link'}));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      `http://localhost/organizations/org-slug/issues/1/events/1/`
    );
  });

  it('should copy as markdown', async () => {
    const group = GroupFixture({isPublic: true, shareId: '12345'});
    GroupStore.add([group]);

    renderGlobalModal();

    act(() =>
      openModal(modalProps => (
        <ShareIssueModal
          {...modalProps}
          groupId={group.id}
          organization={organization}
          projectSlug={project.slug}
          onToggle={onToggle}
          event={null}
          hasIssueShare
        />
      ))
    );

    expect(screen.getByText('Share Issue')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Copy as Markdown'}));

    expect(navigator.clipboard.writeText).toHaveBeenCalledWith(
      '[JAVASCRIPT-6QS](http://localhost/organizations/org-slug/issues/1/)'
    );
  });

  it('should public share', async () => {
    const group = GroupFixture();
    GroupStore.add([group]);

    const issuesApi = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/issues/`,
      method: 'PUT',
      body: {...group, isPublic: true, shareId: '12345'},
    });
    renderGlobalModal();

    act(() =>
      openModal(modalProps => (
        <ShareIssueModal
          {...modalProps}
          groupId={group.id}
          organization={organization}
          projectSlug={project.slug}
          onToggle={onToggle}
          event={null}
          hasIssueShare
        />
      ))
    );

    await userEvent.click(screen.getByLabelText('Publish'));
    expect(
      await screen.findByRole('button', {name: 'Copy Public Link'})
    ).toBeInTheDocument();
    expect(issuesApi).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('should public unshare', async () => {
    const group = GroupFixture({isPublic: true, shareId: '12345'});
    GroupStore.add([group]);

    const issuesApi = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/issues/`,
      method: 'PUT',
      body: {...group, isPublic: false, shareId: null},
    });
    renderGlobalModal();

    act(() =>
      openModal(modalProps => (
        <ShareIssueModal
          {...modalProps}
          groupId={group.id}
          organization={organization}
          projectSlug={project.slug}
          onToggle={onToggle}
          event={null}
          hasIssueShare
        />
      ))
    );

    await userEvent.click(screen.getByLabelText('Unpublish'));

    expect(issuesApi).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
