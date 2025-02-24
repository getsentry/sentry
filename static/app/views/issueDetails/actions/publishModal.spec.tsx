import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, renderGlobalModal, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import GroupStore from 'sentry/stores/groupStore';
import ModalStore from 'sentry/stores/modalStore';
import PublishIssueModal from 'sentry/views/issueDetails/actions/publishModal';

describe('shareModal', () => {
  const project = ProjectFixture();
  const organization = OrganizationFixture();
  const onToggle = jest.fn();

  beforeEach(() => {
    GroupStore.init();
  });
  afterEach(() => {
    ModalStore.reset();
    GroupStore.reset();
    MockApiClient.clearMockResponses();
    jest.clearAllMocks();
  });

  it('should share', async () => {
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
        <PublishIssueModal
          {...modalProps}
          groupId={group.id}
          organization={organization}
          projectSlug={project.slug}
          onToggle={onToggle}
        />
      ))
    );

    expect(screen.getByText('Publish Issue')).toBeInTheDocument();
    await userEvent.click(screen.getByLabelText('Publish'));
    expect(await screen.findByRole('button', {name: 'Copy Link'})).toBeInTheDocument();
    expect(issuesApi).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('should unshare', async () => {
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
        <PublishIssueModal
          {...modalProps}
          groupId={group.id}
          organization={organization}
          projectSlug={project.slug}
          onToggle={onToggle}
        />
      ))
    );

    await userEvent.click(screen.getByLabelText('Unpublish'));

    expect(issuesApi).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
