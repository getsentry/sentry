import {Fragment} from 'react';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, within} from 'sentry-test/reactTestingLibrary';

import EventTagsAndScreenshot from 'sentry/components/events/eventTagsAndScreenshot';
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

  const event = TestStubs.Event({user});

  const {organization, project, router} = initializeOrg({
    organization: {
      role: 'member',
      attachmentsRole: 'member',
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

  describe('renders tags only', function () {
    it('not shared event - without attachments', function () {
      const {container} = render(
        <EventTagsAndScreenshot
          event={{...event, tags, contexts}}
          organization={organization}
          projectId={project.slug}
          location={router.location}
          attachments={[]}
          onDeleteScreenshot={() => jest.fn()}
          hasContext
        />
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

      expect(container).toSnapshot();
    });

    it('shared event - without attachments', function () {
      const {container} = render(
        <EventTagsAndScreenshot
          event={{...event, tags, contexts}}
          organization={organization}
          projectId={project.slug}
          location={router.location}
          attachments={[]}
          onDeleteScreenshot={() => jest.fn()}
          hasContext
          isShare
        />
      );

      // Screenshot Container
      expect(screen.queryByText('Screenshot')).not.toBeInTheDocument();

      // Tags Container
      expect(screen.getByText('Tags')).toBeInTheDocument();

      expect(container).toSnapshot();
    });

    it('shared event - with attachments', function () {
      const {container} = render(
        <EventTagsAndScreenshot
          event={{...event, tags, contexts}}
          organization={organization}
          projectId={project.slug}
          location={router.location}
          attachments={attachments}
          onDeleteScreenshot={() => jest.fn()}
          hasContext
          isShare
        />
      );

      // Screenshot Container
      expect(screen.queryByText('Screenshot')).not.toBeInTheDocument();

      // Tags Container
      expect(screen.getByText('Tags')).toBeInTheDocument();

      expect(container).toSnapshot();
    });
  });

  describe('renders screenshot only', function () {
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

    it('no context and no tags', async function () {
      const {container} = render(
        <Fragment>
          <GlobalModal />
          <EventTagsAndScreenshot
            event={event}
            organization={organization}
            projectId={project.slug}
            location={router.location}
            attachments={attachments}
            onDeleteScreenshot={() => jest.fn()}
            hasContext={false}
          />
        </Fragment>
      );

      // Tags Container
      expect(screen.queryByText('Tags')).not.toBeInTheDocument();

      // Screenshot Container
      expect(screen.getByText('Screenshot')).toBeInTheDocument();
      expect(screen.getByText('View screenshot')).toBeInTheDocument();
      expect(screen.getByTestId('image-viewer')).toHaveAttribute(
        'src',
        `/api/0/projects/${organization.slug}/${project.slug}/events/${event.id}/attachments/${attachments[1].id}/?download`
      );

      // Display help text when hovering question element
      userEvent.hover(screen.getByTestId('more-information'));

      expect(
        await screen.findByText(
          'This image was captured around the time that the event occurred.'
        )
      ).toBeInTheDocument();

      // Screenshot is clickable
      userEvent.click(screen.getByTestId('image-viewer'));

      // Open 'view screenshot' dialog
      expect(screen.getByRole('dialog')).toBeInTheDocument();
      expect(
        within(screen.getByRole('dialog')).getByText('Screenshot')
      ).toBeInTheDocument();

      userEvent.click(screen.getByLabelText('Close Modal'));

      expect(container).toSnapshot();
    });
  });

  describe('renders screenshot and tags', function () {
    it('has context, tags and attachments', function () {
      const {container} = render(
        <EventTagsAndScreenshot
          event={{...event, tags, contexts}}
          organization={organization}
          projectId={project.slug}
          location={router.location}
          attachments={attachments}
          onDeleteScreenshot={() => jest.fn()}
          hasContext
        />
      );

      // Screenshot Container
      expect(screen.getByText('Screenshot')).toBeInTheDocument();
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
      expect(tagsContainer.getAllByRole('listitem')).toHaveLength(tags.length);

      expect(container).toSnapshot();
    });

    it('has context and attachments only', function () {
      const {container} = render(
        <EventTagsAndScreenshot
          event={{...event, contexts}}
          organization={organization}
          projectId={project.slug}
          location={router.location}
          attachments={attachments}
          onDeleteScreenshot={() => jest.fn()}
          hasContext
        />
      );

      // Screenshot Container
      expect(screen.getByText('Screenshot')).toBeInTheDocument();
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

      expect(container).toSnapshot();
    });

    it('has tags and attachments only', function () {
      const {container} = render(
        <EventTagsAndScreenshot
          event={{...event, tags}}
          organization={organization}
          projectId={project.slug}
          location={router.location}
          attachments={attachments}
          onDeleteScreenshot={() => jest.fn()}
          hasContext={false}
        />
      );

      // Screenshot Container
      expect(screen.getByText('Screenshot')).toBeInTheDocument();
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

      expect(container).toSnapshot();
    });
  });
});
