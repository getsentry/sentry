import {EventFixture} from 'sentry-fixture/event';
import {EventAttachmentFixture} from 'sentry-fixture/eventAttachment';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ScreenshotDataSection} from 'sentry/components/events/eventTagsAndScreenshot/screenshot/screenshotDataSection';
import ProjectsStore from 'sentry/stores/projectsStore';

describe('ScreenshotDataSection', function () {
  const organization = OrganizationFixture({
    features: ['event-attachments'],
    orgRole: 'member',
    attachmentsRole: 'member',
  });
  const project = ProjectFixture();
  const event = EventFixture();

  beforeEach(() => {
    ProjectsStore.loadInitialData([project]);
  });

  it('renders without error when screenshot has application/json mimetype', async function () {
    const attachment = EventAttachmentFixture({
      name: 'screenshot.png',
      mimetype: 'application/json',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/attachments/`,
      body: [attachment],
    });

    render(<ScreenshotDataSection event={event} projectSlug={project.slug} />, {
      organization,
    });

    expect(await screen.findByTestId('image-viewer')).toBeInTheDocument();
  });
});
