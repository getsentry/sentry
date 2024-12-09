import {EventAttachmentFixture} from 'sentry-fixture/eventAttachment';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {TagsFixture} from 'sentry-fixture/tags';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {AttachmentsBadge} from './attachmentsBadge';

describe('AttachmentsBadge', () => {
  const organization = OrganizationFixture();
  const group = GroupFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/tags/`,
      body: TagsFixture(),
      method: 'GET',
    });
  });

  it('does not show up if there are no attachments', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/attachments/`,
      body: [],
    });

    const {container} = render(<AttachmentsBadge group={group} />);

    // Wait for requests to finish
    await act(tick);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders 1 when there is only 1 attachment', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/attachments/`,
      body: [EventAttachmentFixture()],
    });

    render(<AttachmentsBadge group={group} />);

    expect(
      await screen.findByRole('button', {name: "View this issue's attachments"})
    ).toBeInTheDocument();
  });

  it('renders 50+ when there is a next page', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/attachments/`,
      body: [EventAttachmentFixture()],
      headers: {
        // Assumes there is more than 50 attachments if there is a next page
        Link: '<https://sentry.io>; rel="previous"; results="false"; cursor="0:0:1", <https://sentry.io>; rel="next"; results="true"; cursor="0:20:0"',
      },
    });

    render(<AttachmentsBadge group={group} />);

    const button = await screen.findByRole('button', {
      name: "View this issue's attachments",
    });
    expect(button).toBeInTheDocument();
    expect(button).toHaveAttribute('href', expect.stringContaining('/attachments/'));
  });
});
