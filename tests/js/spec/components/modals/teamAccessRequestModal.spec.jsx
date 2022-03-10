import {mountWithTheme} from 'sentry-test/enzyme';

import TeamAccessRequestModal from 'sentry/components/modals/teamAccessRequestModal';

describe('TeamAccessRequestModal', function () {
  let wrapper;
  let createMock;

  const closeModal = jest.fn();
  const onClose = jest.fn();
  const orgId = TestStubs.Organization().slug;
  const memberId = TestStubs.Member().id;
  const teamId = TestStubs.Team().slug;

  const modalRenderProps = {
    Body: p => p.children,
    Footer: p => p.children,
    Header: p => p.children,
    closeModal,
    onClose,
  };

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    wrapper = mountWithTheme(
      <TeamAccessRequestModal
        orgId={orgId}
        teamId={teamId}
        memberId={memberId}
        {...modalRenderProps}
      />
    );

    createMock = MockApiClient.addMockResponse({
      url: `/organizations/${orgId}/members/${memberId}/teams/${teamId}/`,
      method: 'POST',
    });
  });

  it('renders', function () {
    expect(wrapper.find('Body').text()).toBe(
      `You do not have permission to add members to the #${teamId} team, but we will send a request to your organization admins for approval.`
    );
  });

  it('creates access request on continue', function () {
    wrapper.find('button[aria-label="Continue"]').simulate('click');
    expect(createMock).toHaveBeenCalled();
  });

  it('closes modal on cancel', function () {
    wrapper.find('button[aria-label="Cancel"]').simulate('click');
    expect(createMock).not.toHaveBeenCalled();
    expect(closeModal).toHaveBeenCalled();
  });
});
