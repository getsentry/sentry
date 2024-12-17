import {Fragment} from 'react';
import {EventFixture} from 'sentry-fixture/event';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';

import {TagFilter} from 'sentry/components/events/eventTags/util';
import {EventTagsAndScreenshot} from 'sentry/components/events/eventTagsAndScreenshot';
import GlobalModal from 'sentry/components/globalModal';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {EventAttachment} from 'sentry/types/group';

describe('EventTagsAndScreenshot', function () {
  const user = {
    id: '1',
    email: 'tony1@example.com',
    ip_address: '213.142.96.194',
    geo: {country_code: 'AT', city: 'Vienna', region: 'Austria'},
    isSuperuser: true,
  };

  const tags = [
    {
      key: 'app.device',
      value: '0b77c3f2567d65fe816e1fa7013779fbe3b51633',
    },
    {
      key: 'device',
      value: 'iPhone13,4',
    },
    {
      key: 'device.family',
      value: 'iOS',
    },
    {
      key: 'dist',
      value: '390',
    },
    {
      key: 'environment',
      value: 'debug',
    },
    {
      key: 'language',
      value: 'swift',
    },
    {
      key: 'level',
      value: 'info',
    },
    {
      key: 'os',
      value: 'iOS 14.7.1',
    },
    {
      key: 'os.name',
      value: 'iOS',
    },
    {
      key: 'os.rooted',
      value: 'no',
    },
    {
      key: 'release',
      value: 'io.sentry.sample.iOS-Swift@7.2.3+390',
    },
    {
      key: 'transaction',
      value: 'iOS_Swift.ViewController',
    },
    {
      key: 'user',
      value: 'id:1',
      query: 'user.id:"1"',
    },
  ];

  const event = EventFixture({user, tags});

  const {organization, project} = initializeOrg({
    organization: {
      orgRole: 'member',
      attachmentsRole: 'member',
      features: ['event-attachments'],
      orgRoleList: [
        {
          id: 'member',
          name: 'Member',
          desc: '...',
          minimumTeamRole: 'contributor',
        },
      ],
    },
  } as Parameters<typeof initializeOrg>[0]);

  const attachments: EventAttachment[] = [
    {
      id: '1765467044',
      name: 'log.txt',
      headers: {'Content-Type': 'application/octet-stream'},
      mimetype: 'application/octet-stream',
      size: 5,
      sha1: 'aaf4c61ddcc5e8a2dabede0f3b482cd9aea9434d',
      dateCreated: '2021-08-31T15:14:53.113630Z',
      type: 'event.attachment',
      event_id: 'bbf4c61ddaa7d8b2dbbede0f3b482cd9beb9434d',
    },
    {
      id: '1765467046',
      name: 'screenshot.jpg',
      headers: {'Content-Type': 'image/jpeg'},
      mimetype: 'image/jpeg',
      size: 239154,
      sha1: '657eae9c13474518a6d0175bd4ab6bb4f81bf40e',
      dateCreated: '2021-08-31T15:14:53.130940Z',
      type: 'event.attachment',
      event_id: 'bbf4c61ddaa7d8b2dbbede0f3b482cd9beb9434d',
    },
  ];

  let mockDetailedProject: jest.Mock;
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/repos/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/projects/org-slug/project-slug/releases/io.sentry.sample.iOS-Swift%407.2.3%2B390/',
      body: {},
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/io.sentry.sample.iOS-Swift%407.2.3%2B390/deploys/',
      body: [],
    });
    ProjectsStore.init();
    ProjectsStore.loadInitialData([project]);
    mockDetailedProject = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/`,
      body: project,
    });
  });

  async function assertTagsView() {
    expect(screen.getByText('Tags')).toBeInTheDocument();
    const tagsContainer = within(screen.getByTestId('event-tags'));
    expect(tagsContainer.getAllByRole('radio')).toHaveLength(
      Object.keys(TagFilter).length
    );

    await expect(mockDetailedProject).toHaveBeenCalled();
    expect(await tagsContainer.findByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(screen.getByTestId('event-tags-tree')).toBeInTheDocument();
  }

  /**
   * Asserts rendering of the tags portion as both a shared event and regular event
   */
  async function assertTagsViewAsShare() {
    const eventTags = render(
      <EventTagsAndScreenshot event={event} projectSlug={project.slug} />,
      {organization}
    );
    await assertTagsView();
    eventTags.unmount();

    const eventTagsAsScreenshot = render(
      <EventTagsAndScreenshot event={event} projectSlug={project.slug} isShare />,
      {organization}
    );
    await assertTagsView();
    eventTagsAsScreenshot.unmount();

    const eventTagsWithAttachment = render(
      <EventTagsAndScreenshot event={event} projectSlug={project.slug} isShare />
    );
    await assertTagsView();
    eventTagsWithAttachment.unmount();
  }
  describe('renders tags only', function () {
    it('tags only', async function () {
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/attachments/`,
        body: [],
      });
      await assertTagsViewAsShare();
      expect(screen.queryByText('Screenshot')).not.toBeInTheDocument();
    });

    it('tags and attachments', async function () {
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/attachments/`,
        body: attachments,
      });
      await assertTagsViewAsShare();
    });

    it('allows filtering tags', async function () {
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/attachments/`,
        body: [],
      });
      const applicationTags = [
        {key: 'app', value: 'Sentry'},
        {key: 'app.app_start_time', value: '2008-05-08T00:00:00.000Z'},
        {key: 'app.app_name', value: 'com.sentry.app'},
        {key: 'app.app_version', value: '0.0.2'},
      ];
      const customTags = [
        {key: 'custom', value: 'some-value'},
        {key: 'custom.nested', value: 'some-other-value'},
      ];
      const allTags = applicationTags.concat(customTags);
      const testEvent = EventFixture({tags: allTags});
      render(<EventTagsAndScreenshot projectSlug={project.slug} event={testEvent} />, {
        organization,
      });
      expect(mockDetailedProject).toHaveBeenCalled();
      expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();

      let rows = screen.getAllByTestId('tag-tree-row');
      expect(rows).toHaveLength(allTags.length);

      await userEvent.click(screen.getByTestId(TagFilter.APPLICATION));
      rows = screen.getAllByTestId('tag-tree-row');
      expect(rows).toHaveLength(applicationTags.length);

      // Hide categories that don't have tags for this event
      expect(screen.queryByTestId(TagFilter.CLIENT)).not.toBeInTheDocument();
      expect(screen.queryByTestId(TagFilter.OTHER)).not.toBeInTheDocument();

      // Always show 'Custom' and 'All' selectors though
      await userEvent.click(screen.getByTestId(TagFilter.CUSTOM));
      rows = screen.getAllByTestId('tag-tree-row');
      expect(rows).toHaveLength(customTags.length);

      await userEvent.click(screen.getByTestId(TagFilter.ALL));
      rows = screen.getAllByTestId('tag-tree-row');
      expect(rows).toHaveLength(allTags.length);
    });

    it('promotes custom tags', async function () {
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/attachments/`,
        body: [],
      });
      const applicationTags = [
        {key: 'app', value: 'Sentry'},
        {key: 'app.app_start_time', value: '2008-05-08T00:00:00.000Z'},
        {key: 'app.app_name', value: 'com.sentry.app'},
        {key: 'app.app_version', value: '0.0.2'},
      ];
      const testEvent = EventFixture({tags: applicationTags});
      render(<EventTagsAndScreenshot projectSlug={project.slug} event={testEvent} />, {
        organization,
      });
      expect(mockDetailedProject).toHaveBeenCalled();
      expect(await screen.findByTestId('loading-indicator')).not.toBeInTheDocument();

      const rows = screen.getAllByTestId('tag-tree-row');
      expect(rows).toHaveLength(applicationTags.length);

      expect(screen.queryByTestId(TagFilter.CLIENT)).not.toBeInTheDocument();
      expect(screen.queryByTestId(TagFilter.OTHER)).not.toBeInTheDocument();

      // Even without custom tags, show the banner when category is selected
      await userEvent.click(screen.getByTestId(TagFilter.CUSTOM));
      expect(screen.getByTestId('event-tags-custom-banner')).toBeInTheDocument();
    });
  });

  describe('renders screenshot only', function () {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/attachments/`,
        body: attachments,
      });
      MockApiClient.addMockResponse({
        url: '/projects/org-slug/project-slug/releases/io.sentry.sample.iOS-Swift%407.2.3%2B390/',
        body: {},
      });
    });

    it('no tags', async function () {
      render(
        <Fragment>
          <GlobalModal />
          <EventTagsAndScreenshot
            event={{...event, tags: []}}
            projectSlug={project.slug}
          />
        </Fragment>,
        {organization}
      );

      // Tags Container
      expect(screen.queryByText('Tags')).not.toBeInTheDocument();

      // Screenshot Container
      expect(
        (await screen.findByTestId('screenshot-data-section'))?.textContent
      ).toContain('Screenshot');
      expect(screen.getByText('View screenshot')).toBeInTheDocument();
      expect(screen.getByTestId('image-viewer')).toHaveAttribute(
        'src',
        `/api/0/projects/${organization.slug}/${project.slug}/events/${event.id}/attachments/${attachments[1].id}/?download`
      );

      // Display help text when hovering question element
      await userEvent.hover(screen.getByTestId('more-information'));

      expect(
        await screen.findByText(
          'This image was captured around the time that the event occurred.'
        )
      ).toBeInTheDocument();

      // Screenshot is clickable
      await userEvent.click(screen.getByTestId('image-viewer'));

      // Open 'view screenshot' dialog
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(
        within(screen.getByRole('dialog')).getByText('Screenshot')
      ).toBeInTheDocument();

      await userEvent.click(screen.getByLabelText('Close Modal'));
    });
  });

  describe('renders screenshot and tags', function () {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/attachments/`,
        body: attachments,
      });
    });

    it('has tags and attachments', async function () {
      render(<EventTagsAndScreenshot event={event} projectSlug={project.slug} />, {
        organization,
      });
      await assertTagsView();

      // Screenshot Container
      expect(await screen.findByText('View screenshot')).toBeInTheDocument();
      expect(screen.getByTestId('image-viewer')).toHaveAttribute(
        'src',
        `/api/0/projects/${organization.slug}/${project.slug}/events/${event.id}/attachments/${attachments[1].id}/?download`
      );

      expect(screen.getByTestId('screenshot-data-section')?.textContent).toContain(
        'Screenshot'
      );
      expect(
        screen.queryByRole('button', {name: 'Previous Screenshot'})
      ).not.toBeInTheDocument();
      expect(
        screen.queryByRole('button', {name: 'Next Screenshot'})
      ).not.toBeInTheDocument();
    });

    it('renders multiple screenshots correctly', async function () {
      MockApiClient.clearMockResponses();
      const moreAttachments = [
        ...attachments,
        {
          id: '1765467047',
          name: 'screenshot-2.jpg',
          headers: {'Content-Type': 'image/jpeg'},
          mimetype: 'image/jpeg',
          size: 239154,
          sha1: '657eae9c13474518a6d0175bd4ab6bb4f81bf40d',
          dateCreated: '2021-08-31T15:14:53.130940Z',
          type: 'event.attachment',
          event_id: 'bbf4c61ddaa7d8b2dbbede0f3b482cd9beb9434d',
        },
      ];
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/attachments/`,
        body: moreAttachments,
      });
      render(
        <EventTagsAndScreenshot
          event={{...event, tags: []}}
          projectSlug={project.slug}
        />,
        {organization}
      );

      expect(
        (await screen.findByTestId('screenshot-data-section'))?.textContent
      ).toContain('1 of 2');

      expect(screen.getByText('View screenshot')).toBeInTheDocument();
      expect(screen.getByTestId('image-viewer')).toHaveAttribute(
        'src',
        `/api/0/projects/${organization.slug}/${project.slug}/events/${event.id}/attachments/${moreAttachments[1].id}/?download`
      );

      await userEvent.click(screen.getByRole('button', {name: 'Next Screenshot'}));

      expect(await screen.findByTestId('screenshot-data-section')).toHaveTextContent(
        '2 of 2'
      );

      expect(screen.getByText('View screenshot')).toBeInTheDocument();
      expect(screen.getByTestId('image-viewer')).toHaveAttribute(
        'src',
        `/api/0/projects/${organization.slug}/${project.slug}/events/${event.id}/attachments/${moreAttachments[2].id}/?download`
      );
    });

    it('can delete a screenshot', async function () {
      MockApiClient.clearMockResponses();
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/attachments/`,
        body: attachments,
      });
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/attachments/1765467046/`,
        method: 'DELETE',
      });
      render(
        <EventTagsAndScreenshot
          event={{...event, tags: []}}
          projectSlug={project.slug}
        />,
        {organization}
      );
      renderGlobalModal();

      // Open screenshot menu and select delete
      await userEvent.click(
        await screen.findByRole('button', {name: 'More screenshot actions'})
      );
      await userEvent.click(screen.getByRole('menuitemradio', {name: 'Delete'}));

      // Selecting delete should open a confirmation modal
      expect(
        within(screen.getByRole('dialog')).getByText(
          /are you sure you want to delete this image/i
        )
      ).toBeInTheDocument();
      await userEvent.click(
        within(screen.getByRole('dialog')).getByRole('button', {name: 'Confirm'})
      );

      // Screenshot should be removed after confirmation
      expect(
        screen.queryByRole('button', {name: 'View screenshot'})
      ).not.toBeInTheDocument();
    });

    it('attachments only', async function () {
      render(<EventTagsAndScreenshot event={event} projectSlug={project.slug} />, {
        organization,
      });
      await assertTagsView();

      // Screenshot Container
      expect(
        (await screen.findByTestId('screenshot-data-section'))?.textContent
      ).toContain('Screenshot');
      expect(screen.getByText('View screenshot')).toBeInTheDocument();
      expect(screen.getByTestId('image-viewer')).toHaveAttribute(
        'src',
        `/api/0/projects/${organization.slug}/${project.slug}/events/${event.id}/attachments/${attachments[1].id}/?download`
      );
    });
  });
});
