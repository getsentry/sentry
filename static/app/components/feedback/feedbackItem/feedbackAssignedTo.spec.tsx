import {EventFixture} from 'sentry-fixture/event';
import {FeedbackIssueFixture} from 'sentry-fixture/feedbackIssue';
import {MemberFixture} from 'sentry-fixture/member';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';
import {UserFixture} from 'sentry-fixture/user';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import MemberListStore from 'sentry/stores/memberListStore';
import type {Group} from 'sentry/types/group';

import FeedbackAssignedTo from './feedbackAssignedTo';

describe('FeedbackAssignedTo', () => {
  const user = UserFixture();
  const organization = OrganizationFixture();
  const feedbackIssue = FeedbackIssueFixture({}) as unknown as Group;
  const feedbackEvent = EventFixture();
  const project = ProjectFixture();

  beforeEach(() => {
    MemberListStore.reset();

    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/users/`,
      body: [MemberFixture({user})],
    });
    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/events/${feedbackEvent.id}/owners/`,
      body: {
        owners: [],
        rules: [],
      },
    });
  });

  it('should assign to user', async () => {
    const assignMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: `/organizations/${organization.slug}/issues/${feedbackIssue.id}/`,
      body: {...feedbackIssue, assignedTo: {id: user.id, type: 'user', name: user.name}},
    });

    render(
      <FeedbackAssignedTo feedbackIssue={feedbackIssue} feedbackEvent={feedbackEvent} />
    );

    await userEvent.click(await screen.findByLabelText('Modify issue assignee'));
    await userEvent.click(screen.getByText(`${user.name} (You)`));

    await waitFor(() =>
      expect(assignMock).toHaveBeenLastCalledWith(
        `/organizations/${organization.slug}/issues/${feedbackIssue.id}/`,
        expect.objectContaining({
          data: {assignedTo: `user:${user.id}`, assignedBy: 'assignee_selector'},
        })
      )
    );
    expect(assignMock).toHaveBeenCalledTimes(1);
  });

  it('should clear assignee', async () => {
    const assignMock = MockApiClient.addMockResponse({
      method: 'PUT',
      url: `/organizations/${organization.slug}/issues/${feedbackIssue.id}/`,
      body: {...feedbackIssue, assignedTo: null},
    });

    render(
      <FeedbackAssignedTo
        feedbackIssue={{
          ...feedbackIssue,
          assignedTo: {id: user.id, type: 'user', name: user.name},
        }}
        feedbackEvent={feedbackEvent}
      />
    );

    await userEvent.click(await screen.findByLabelText('Modify issue assignee'));
    await userEvent.click(await screen.findByRole('button', {name: 'Clear'}));

    await waitFor(() =>
      expect(assignMock).toHaveBeenLastCalledWith(
        `/organizations/${organization.slug}/issues/${feedbackIssue.id}/`,
        expect.objectContaining({
          data: {assignedBy: 'assignee_selector', assignedTo: ''},
        })
      )
    );
    expect(assignMock).toHaveBeenCalledTimes(1);
  });
});
