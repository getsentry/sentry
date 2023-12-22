import styled from '@emotion/styled';
import {Member as MemberFixture} from 'sentry-fixture/member';
import {Organization} from 'sentry-fixture/organization';
import {Team} from 'sentry-fixture/team';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {makeCloseButton} from 'sentry/components/globalModal/components';
import TeamAccessRequestModal, {
  CreateTeamAccessRequestModalProps,
} from 'sentry/components/modals/teamAccessRequestModal';

describe('TeamAccessRequestModal', function () {
  let createMock;

  const closeModal = jest.fn();
  const orgId = Organization().slug;
  const memberId = MemberFixture().id;
  const teamId = Team().slug;

  const styledWrapper = styled(c => c.children);
  const modalRenderProps: CreateTeamAccessRequestModalProps = {
    Body: styledWrapper(),
    Footer: styledWrapper(),
    Header: p => <span>{p.children}</span>,
    closeModal,
    orgId,
    teamId,
    memberId,
    CloseButton: makeCloseButton(() => {}),
    api: new MockApiClient(),
  };

  function renderComponent() {
    return render(<TeamAccessRequestModal {...modalRenderProps} />);
  }

  beforeEach(function () {
    MockApiClient.clearMockResponses();
    createMock = MockApiClient.addMockResponse({
      url: `/organizations/${orgId}/members/${memberId}/teams/${teamId}/`,
      method: 'POST',
    });
  });

  it('renders', function () {
    const {container} = renderComponent();

    expect(container).toHaveTextContent(
      `You do not have permission to add members to the #${teamId} team, but we will send a request to your organization admins for approval.`
    );
  });

  it('creates access request on continue', async function () {
    renderComponent();

    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));
    expect(createMock).toHaveBeenCalled();
  });

  it('closes modal on cancel', async function () {
    renderComponent();

    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(createMock).not.toHaveBeenCalled();
    expect(closeModal).toHaveBeenCalled();
  });
});
