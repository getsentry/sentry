import {EventAttachmentFixture} from 'sentry-fixture/eventAttachment';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import ScreenshotModal from 'sentry/components/events/eventTagsAndScreenshot/screenshot/modal';
import GroupStore from 'sentry/stores/groupStore';
import ProjectsStore from 'sentry/stores/projectsStore';

const stubEl = (props: {children?: React.ReactNode}) => <div>{props.children}</div>;

describe('ScreenshotModal', function () {
  let initialData: ReturnType<typeof initializeOrg>;
  const project = ProjectFixture();

  beforeEach(() => {
    initialData = initializeOrg({
      organization: OrganizationFixture(),
      router: {
        params: {groupId: 'group-id'},
        location: {query: {types: 'event.screenshot'}},
      },
    });
    ProjectsStore.loadInitialData([project]);
    GroupStore.init();
  });

  it('paginates single screenshots correctly', async function () {
    const eventAttachment = EventAttachmentFixture();
    const attachments = [
      eventAttachment,
      EventAttachmentFixture({id: '2', event_id: 'new event id'}),
      EventAttachmentFixture({id: '3'}),
      EventAttachmentFixture({id: '4'}),
      EventAttachmentFixture({id: '5'}),
      EventAttachmentFixture({id: '6'}),
    ];
    render(
      <ScreenshotModal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={() => undefined}
        onDelete={jest.fn()}
        onDownload={jest.fn()}
        projectSlug={project.slug}
        eventAttachment={eventAttachment}
        downloadUrl="/testing/download-href"
        groupId="group-id"
        attachments={attachments}
      />,
      {
        organization: initialData.organization,
      }
    );
    expect(screen.getByRole('button', {name: 'Previous'})).toBeDisabled();
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(screen.getByText('new event id')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Previous'})).toBeEnabled();
  });

  it('renders with previous and next buttons when passed attachments', async function () {
    const eventAttachment = EventAttachmentFixture();
    const attachments = [
      eventAttachment,
      EventAttachmentFixture({id: '2'}),
      EventAttachmentFixture({name: 'other-image.png'}),
      EventAttachmentFixture({
        name: 'textfile.txt',
        mimetype: 'text/plain',
        headers: {'Content-Type': 'text/plain'},
      }),
    ];

    render(
      <ScreenshotModal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={() => undefined}
        onDelete={jest.fn()}
        onDownload={jest.fn()}
        projectSlug={project.slug}
        eventAttachment={eventAttachment}
        attachments={attachments}
        downloadUrl="/testing/download-href"
        groupId="group-id"
      />,
      {
        organization: initialData.organization,
      }
    );

    expect(screen.getByRole('button', {name: 'Previous'})).toBeDisabled();
    expect(screen.getByText('1 of 2')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    expect(screen.getByRole('button', {name: 'Next'})).toBeDisabled();
    expect(screen.getByText('2 of 2')).toBeInTheDocument();
  });

  it('does not render pagination buttons when only one screenshot', function () {
    const eventAttachment = EventAttachmentFixture();
    render(
      <ScreenshotModal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={() => undefined}
        onDelete={jest.fn()}
        onDownload={jest.fn()}
        projectSlug={project.slug}
        eventAttachment={eventAttachment}
        downloadUrl="/testing/download-href"
        groupId="group-id"
      />,
      {
        organization: initialData.organization,
      }
    );

    expect(screen.getByText(eventAttachment.name)).toBeInTheDocument();

    expect(screen.queryByRole('button', {name: 'Previous'})).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Next'})).not.toBeInTheDocument();
  });
});
