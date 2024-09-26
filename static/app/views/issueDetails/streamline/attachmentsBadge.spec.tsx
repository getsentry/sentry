import {EventAttachmentFixture} from 'sentry-fixture/eventAttachment';
import {GroupFixture} from 'sentry-fixture/group';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {act, render, screen} from 'sentry-test/reactTestingLibrary';

import {AttachmentsBadge} from './attachmentsBadge';

describe('AttachmentsBadge', () => {
  const organization = OrganizationFixture();
  const group = GroupFixture();
  const project = ProjectFixture();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
  });

  it('does not show up if there are no attachments', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/attachments/`,
      body: [],
    });

    const {container} = render(<AttachmentsBadge group={group} project={project} />);

    // Wait for requests to finish
    await act(tick);
    expect(container).toBeEmptyDOMElement();
  });

  it('renders 1 when there is only 1 attachment', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/issues/${group.id}/attachments/`,
      body: [EventAttachmentFixture()],
    });

    render(<AttachmentsBadge group={group} project={project} />);

    expect(await screen.findByRole('button', {name: '1 Attachment'})).toBeInTheDocument();
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

    render(<AttachmentsBadge group={group} project={project} />);

    expect(
      await screen.findByRole('button', {name: '50+ Attachments'})
    ).toBeInTheDocument();
  });
});
