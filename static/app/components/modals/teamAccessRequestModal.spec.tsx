import type {PropsWithChildren} from 'react';
import styled from '@emotion/styled';
import {MemberFixture} from 'sentry-fixture/member';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {TeamFixture} from 'sentry-fixture/team';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {makeCloseButton} from '@sentry/scraps/modal';
import {toast} from '@sentry/scraps/toast';

import type {CreateTeamAccessRequestModalProps} from './teamAccessRequestModal';
import TeamAccessRequestModal from './teamAccessRequestModal';

describe('TeamAccessRequestModal', () => {
  let createMock: any;

  const closeModal = jest.fn();
  const orgId = OrganizationFixture().slug;
  const memberId = MemberFixture().id;
  const teamId = TeamFixture().slug;

  const styledWrapper = styled((c: PropsWithChildren) => c.children);
  const modalRenderProps: CreateTeamAccessRequestModalProps = {
    Body: styledWrapper(),
    Footer: styledWrapper(),
    Header: p => <span>{p.children}</span>,
    closeModal,
    orgId,
    teamId,
    memberId,
    CloseButton: makeCloseButton(() => {}),
  };

  beforeEach(() => {
    jest.spyOn(toast, 'success');
    jest.spyOn(toast, 'error');
    MockApiClient.clearMockResponses();
    createMock = MockApiClient.addMockResponse({
      url: `/organizations/${orgId}/members/${memberId}/teams/${teamId}/`,
      method: 'POST',
    });
  });

  it('renders', () => {
    const {container} = render(<TeamAccessRequestModal {...modalRenderProps} />);

    expect(container).toHaveTextContent(
      `You do not have permission to add members to the #${teamId} team, but we will send a request to your organization admins for approval.`
    );
  });

  it('creates access request on continue', async () => {
    render(<TeamAccessRequestModal {...modalRenderProps} />);

    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));
    expect(createMock).toHaveBeenCalled();
    await waitFor(() => expect(closeModal).toHaveBeenCalled());
    expect(toast.success).toHaveBeenCalledWith('Team request sent for approval');
  });

  it('closes modal when the request fails', async () => {
    MockApiClient.clearMockResponses();
    const failingMock = MockApiClient.addMockResponse({
      url: `/organizations/${orgId}/members/${memberId}/teams/${teamId}/`,
      method: 'POST',
      statusCode: 400,
    });
    render(<TeamAccessRequestModal {...modalRenderProps} />);

    await userEvent.click(screen.getByRole('button', {name: 'Continue'}));

    expect(failingMock).toHaveBeenCalled();
    await waitFor(() => expect(closeModal).toHaveBeenCalled());
    expect(toast.error).toHaveBeenCalledWith('Unable to send team request');
  });

  it('closes modal on cancel', async () => {
    render(<TeamAccessRequestModal {...modalRenderProps} />);

    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));
    expect(createMock).not.toHaveBeenCalled();
    expect(closeModal).toHaveBeenCalled();
  });
});
