import {renderGlobalModal, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {openModal} from 'sentry/actionCreators/modal';
import GroupStore from 'sentry/stores/groupStore';
import ModalStore from 'sentry/stores/modalStore';
import ShareIssueModal from 'sentry/views/organizationGroupDetails/actions/shareModal';

describe('shareModal', () => {
  const project = TestStubs.Project();
  const organization = TestStubs.Organization();
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

  it('should share on open', async () => {
    const group = TestStubs.Group();
    GroupStore.add([group]);

    const issuesApi = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/issues/`,
      method: 'PUT',
      body: {...group, isPublic: true, shareId: '12345'},
    });
    renderGlobalModal();

    openModal(modalProps => (
      <ShareIssueModal
        {...modalProps}
        groupId={group.id}
        organization={organization}
        projectSlug={project.slug}
        onToggle={onToggle}
      />
    ));

    expect(screen.getByText('Share Issue')).toBeInTheDocument();
    expect(await screen.findByRole('button', {name: 'Copy Link'})).toBeInTheDocument();
    expect(issuesApi).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });

  it('should unshare', async () => {
    const group = TestStubs.Group({isPublic: true, shareId: '12345'});
    GroupStore.add([group]);

    const issuesApi = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/issues/`,
      method: 'PUT',
      body: {...group, isPublic: false, shareId: null},
    });
    renderGlobalModal();

    openModal(modalProps => (
      <ShareIssueModal
        {...modalProps}
        groupId={group.id}
        organization={organization}
        projectSlug={project.slug}
        onToggle={onToggle}
      />
    ));

    userEvent.click(screen.getByLabelText('Unshare'));

    expect(await screen.findByRole('button', {name: 'Close'})).toBeInTheDocument();
    expect(issuesApi).toHaveBeenCalledTimes(1);
    expect(onToggle).toHaveBeenCalledTimes(1);
  });
});
