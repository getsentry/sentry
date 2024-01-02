import {Fragment} from 'react';
import {Event as EventFixture} from 'sentry-fixture/event';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';

import {EventTagsAndScreenshot} from 'sentry/components/events/eventTagsAndScreenshot';
import GlobalModal from 'sentry/components/globalModal';
import {EventAttachment} from 'sentry/types';

import {deviceNameMapper} from '../../../../../static/app/components/deviceName';

describe('EventTagsAndScreenshot', function () {
  const contexts = {
    app: {
      app_start_time: '2021-08-31T15:14:21Z',
      device_app_hash: '0b77c3f2567d65fe816e1fa7013779fbe3b51633',
      build_type: 'test',
      app_identifier: 'io.sentry.sample.iOS-Swift',
      app_name: 'iOS-Swift',
      app_version: '7.2.3',
      app_build: '390',
      app_id: 'B2690307-FDD1-3D34-AA1E-E280A9C2406C',
      type: 'app',
    },
    device: {
      family: 'iOS',
      model: 'iPhone13,4',
      model_id: 'D54pAP',
      memory_size: 5987008512,
      free_memory: 154435584,
      usable_memory: 4706893824,
      storage_size: 127881465856,
      boot_time: '2021-08-29T06:05:51Z',
      timezone: 'CEST',
      type: 'device',
    },
    os: {
      name: 'iOS',
      version: '14.7.1',
      build: '18G82',
      kernel_version:
        'Darwin Kernel Version 20.6.0: Mon Jun 21 21:23:35 PDT 2021; root:xnu-7195.140.42~10/RELEASE_ARM64_T8101',
      rooted: false,
      type: 'os',
    },
  };

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

  const event = EventFixture({user});

  const {organization, project, router} = initializeOrg({
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
  });

  describe('renders tags only', function () {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/attachments/`,
        body: [],
      });
    });

    it('not shared event - without attachments', function () {
      render(
        <EventTagsAndScreenshot
          event={EventFixture({...event, tags, contexts})}
          organization={organization}
          projectSlug={project.slug}
          location={router.location}
        />,
        {organization}
      );

      // Screenshot Container
      expect(screen.queryByText('Screenshot')).not.toBeInTheDocument();

      // Tags Container
      expect(screen.getByText('Tags')).toBeInTheDocument();
      const contextItems = screen.getAllByTestId('context-item');
      expect(contextItems).toHaveLength(Object.keys(contexts).length);

      // Context Item 1
      const contextItem1 = within(contextItems[0]);
      expect(contextItem1.getByRole('heading')).toHaveTextContent(user.email);
      expect(contextItem1.getByTestId('context-sub-title')).toHaveTextContent(
        `ID:${user.id}`
      );

      // Context Item 2
      const contextItem2 = within(contextItems[1]);
      expect(contextItem2.getByRole('heading')).toHaveTextContent(contexts.os.name);
      expect(contextItem2.getByTestId('context-sub-title')).toHaveTextContent(
        `Version:${contexts.os.version}`
      );

      // Context Item 3
      const contextItem3 = within(contextItems[2]);
      expect(contextItem3.getByRole('heading')).toHaveTextContent(
        deviceNameMapper(contexts.device.model)?.trim() ?? ''
      );
      expect(contextItem3.getByTestId('context-sub-title')).toHaveTextContent(
        'Model:iPhone13,4'
      );

      // Tags
      const tagsContainer = within(screen.getByTestId('event-tags'));
      expect(tagsContainer.getAllByRole('listitem')).toHaveLength(tags.length);
    });

    it('shared event - without attachments', function () {
      render(
        <EventTagsAndScreenshot
          event={EventFixture({...event, tags, contexts})}
          organization={organization}
          projectSlug={project.slug}
          location={router.location}
          isShare
        />,
        {organization}
      );

      // Screenshot Container
      expect(screen.queryByText('Screenshot')).not.toBeInTheDocument();

      // Tags Container
      expect(screen.getByText('Tags')).toBeInTheDocument();
    });

    it('shared event - with attachments', function () {
      render(
        <EventTagsAndScreenshot
          event={EventFixture({...event, tags, contexts})}
          organization={organization}
          projectSlug={project.slug}
          location={router.location}
          isShare
        />
      );

      // Screenshot Container
      expect(screen.queryByText('Screenshot')).not.toBeInTheDocument();

      // Tags Container
      expect(screen.getByText('Tags')).toBeInTheDocument();
    });
  });

  describe('renders screenshot only', function () {
    beforeEach(() => {
      MockApiClient.addMockResponse({
        url: `/projects/${organization.slug}/${project.slug}/events/${event.id}/attachments/`,
        body: attachments,
      });
    });

    it('no context and no tags', async function () {
      render(
        <Fragment>
          <GlobalModal />
          <EventTagsAndScreenshot
            event={EventFixture({user: {}, contexts: {}})}
            organization={organization}
            projectSlug={project.slug}
            location={router.location}
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

    it('has context, async tags and attachments', async function () {
      render(
        <EventTagsAndScreenshot
          event={EventFixture({...event, tags, contexts})}
          organization={organization}
          projectSlug={project.slug}
          location={router.location}
        />,
        {organization}
      );

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

      // Tags Container
      expect(screen.getByText('Tags')).toBeInTheDocument();
      const contextItems = screen.getAllByTestId('context-item');
      expect(contextItems).toHaveLength(Object.keys(contexts).length);

      // Tags
      const tagsContainer = within(screen.getByTestId('event-tags'));
      expect(tagsContainer.getAllByRole('listitem')).toHaveLength(tags.length);
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
          event={EventFixture({...event, tags, contexts})}
          organization={organization}
          projectSlug={project.slug}
          location={router.location}
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

      screen.getByRole('button', {name: 'Next Screenshot'}).click();

      expect(screen.getByTestId('screenshot-data-section')?.textContent).toContain(
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
          event={EventFixture({...event, tags, contexts})}
          organization={organization}
          projectSlug={project.slug}
          location={router.location}
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

    it('has context and attachments only', async function () {
      render(
        <EventTagsAndScreenshot
          event={EventFixture({...event, contexts})}
          organization={organization}
          projectSlug={project.slug}
          location={router.location}
        />,
        {organization}
      );

      // Screenshot Container
      expect(
        (await screen.findByTestId('screenshot-data-section'))?.textContent
      ).toContain('Screenshot');
      expect(screen.getByText('View screenshot')).toBeInTheDocument();
      expect(screen.getByTestId('image-viewer')).toHaveAttribute(
        'src',
        `/api/0/projects/${organization.slug}/${project.slug}/events/${event.id}/attachments/${attachments[1].id}/?download`
      );

      // Tags Container
      expect(screen.getByText('Tags')).toBeInTheDocument();
      const contextItems = screen.getAllByTestId('context-item');
      expect(contextItems).toHaveLength(Object.keys(contexts).length);

      // Tags
      const tagsContainer = within(screen.getByTestId('event-tags'));
      expect(tagsContainer.queryByRole('listitem')).not.toBeInTheDocument();
    });

    it('has tags and attachments only', async function () {
      render(
        <EventTagsAndScreenshot
          event={{...event, tags}}
          organization={organization}
          projectSlug={project.slug}
          location={router.location}
        />,
        {organization}
      );

      // Screenshot Container
      expect(
        (await screen.findByTestId('screenshot-data-section'))?.textContent
      ).toContain('Screenshot');
      expect(screen.getByText('View screenshot')).toBeInTheDocument();
      expect(screen.getByTestId('image-viewer')).toHaveAttribute(
        'src',
        `/api/0/projects/${organization.slug}/${project.slug}/events/${event.id}/attachments/${attachments[1].id}/?download`
      );

      // Tags Container
      expect(screen.getByText('Tags')).toBeInTheDocument();
      const contextItems = screen.queryByTestId('context-item');
      expect(contextItems).not.toBeInTheDocument();

      // Tags
      const tagsContainer = within(screen.getByTestId('event-tags'));
      expect(tagsContainer.getAllByRole('listitem')).toHaveLength(tags.length);
    });
  });
});
