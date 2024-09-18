import {EventAttachmentFixture} from 'sentry-fixture/eventAttachment';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import Modal, {
  MAX_SCREENSHOTS_PER_PAGE,
} from 'sentry/components/events/eventTagsAndScreenshot/screenshot/modal';
import GroupStore from 'sentry/stores/groupStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import type {EventAttachment} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';

const stubEl = (props: {children?: React.ReactNode}) => <div>{props.children}</div>;

function renderModal({
  initialData: {organization, router},
  eventAttachment,
  projectSlug,
  attachmentIndex,
  attachments,
  enablePagination,
  groupId,
}: {
  eventAttachment: EventAttachment;
  initialData: any;
  projectSlug: Project['slug'];
  attachmentIndex?: number;
  attachments?: EventAttachment[];
  enablePagination?: boolean;
  groupId?: string;
}) {
  return render(
    <Modal
      Header={stubEl}
      Footer={stubEl as ModalRenderProps['Footer']}
      Body={stubEl as ModalRenderProps['Body']}
      CloseButton={stubEl}
      closeModal={() => undefined}
      onDelete={jest.fn()}
      onDownload={jest.fn()}
      orgSlug={organization.slug}
      projectSlug={projectSlug}
      eventAttachment={eventAttachment}
      downloadUrl=""
      pageLinks={
        '<http://localhost/api/0/issues/group-id/attachments/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1",' +
        '<http://localhost/api/0/issues/group-id/attachments/?cursor=0:12:0>; rel="next"; results="true"; cursor="0:12:0"'
      }
      attachments={attachments}
      attachmentIndex={attachmentIndex}
      groupId={groupId}
      enablePagination={enablePagination}
    />,
    {
      router,
      organization,
    }
  );
}

describe('Modals -> ScreenshotModal', function () {
  let initialData;
  let project;
  let getAttachmentsMock;
  beforeEach(() => {
    initialData = initializeOrg({
      organization: OrganizationFixture(),
      router: {
        params: {groupId: 'group-id'},
        location: {query: {types: 'event.screenshot'}},
      },
    } as Parameters<typeof initializeOrg>[0]);
    project = ProjectFixture();
    ProjectsStore.loadInitialData([project]);
    GroupStore.init();

    getAttachmentsMock = MockApiClient.addMockResponse({
      url: '/issues/group-id/attachments/',
      body: [EventAttachmentFixture()],
      headers: {
        link:
          '<http://localhost/api/0/issues/group-id/attachments/?cursor=0:0:1>; rel="previous"; results="false"; cursor="0:0:1",' +
          '<http://localhost/api/0/issues/group-id/attachments/?cursor=0:12:0>; rel="next"; results="true"; cursor="0:12:0"',
      },
    });
  });

  afterEach(() => {
    MockApiClient.clearMockResponses();
  });
  it('paginates single screenshots correctly', async function () {
    const eventAttachment = EventAttachmentFixture();
    renderModal({
      eventAttachment,
      initialData,
      projectSlug: project.slug,
      attachmentIndex: 0,
      attachments: [
        eventAttachment,
        EventAttachmentFixture({id: '2', event_id: 'new event id'}),
        EventAttachmentFixture({id: '3'}),
        EventAttachmentFixture({id: '4'}),
        EventAttachmentFixture({id: '5'}),
        EventAttachmentFixture({id: '6'}),
      ],
      enablePagination: true,
      groupId: 'group-id',
    });
    expect(screen.getByRole('button', {name: 'Previous'})).toBeDisabled();
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(screen.getByText('new event id')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Previous'})).toBeEnabled();
  });

  it('fetches a new batch of screenshots correctly', async function () {
    const eventAttachment = EventAttachmentFixture();
    const attachments = Array.from({length: MAX_SCREENSHOTS_PER_PAGE}, (_, index) =>
      EventAttachmentFixture({id: `${index + 1}`})
    ).concat(eventAttachment);

    renderModal({
      eventAttachment,
      initialData,
      projectSlug: project.slug,
      attachmentIndex: MAX_SCREENSHOTS_PER_PAGE - 1,
      attachments,
      enablePagination: true,
      groupId: 'group-id',
    });
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));

    await waitFor(() => {
      expect(getAttachmentsMock).toHaveBeenCalledWith(
        '/issues/group-id/attachments/',
        expect.objectContaining({
          query: expect.objectContaining({cursor: '0:12:0'}),
        })
      );
    });
  });

  it('renders with previous and next buttons when passed attachments and index', async function () {
    const eventAttachment = EventAttachmentFixture();
    const attachments = [eventAttachment, EventAttachmentFixture({id: '2'})];
    render(
      <Modal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={() => undefined}
        onDelete={jest.fn()}
        onDownload={jest.fn()}
        orgSlug={initialData.organization.slug}
        projectSlug={project.slug}
        eventAttachment={eventAttachment}
        downloadUrl=""
        attachments={attachments}
        attachmentIndex={0}
        groupId="group-id"
        enablePagination
      />,
      {
        router: initialData.router,
        organization: initialData.organization,
      }
    );

    expect(screen.getByRole('button', {name: 'Previous'})).toBeDisabled();
    expect(screen.getByTestId('pagination-header-text')).toHaveTextContent('1 of 2');
    await userEvent.click(screen.getByRole('button', {name: 'Next'}));
    expect(screen.getByRole('button', {name: 'Next'})).toBeDisabled();
    expect(screen.getByTestId('pagination-header-text')).toHaveTextContent('2 of 2');

    // This pagination doesn't use page links
    expect(getAttachmentsMock).not.toHaveBeenCalled();
  });

  it('does not render pagination buttons when only one screenshot', function () {
    const eventAttachment = EventAttachmentFixture();
    const attachments = [eventAttachment];
    render(
      <Modal
        Header={stubEl}
        Footer={stubEl as ModalRenderProps['Footer']}
        Body={stubEl as ModalRenderProps['Body']}
        CloseButton={stubEl}
        closeModal={() => undefined}
        onDelete={jest.fn()}
        onDownload={jest.fn()}
        orgSlug={initialData.organization.slug}
        projectSlug={project.slug}
        eventAttachment={eventAttachment}
        downloadUrl=""
        attachments={attachments}
        attachmentIndex={0}
        groupId="group-id"
        enablePagination
      />,
      {
        router: initialData.router,
        organization: initialData.organization,
      }
    );

    expect(screen.queryByRole('button', {name: 'Previous'})).not.toBeInTheDocument();
    expect(screen.queryByTestId('pagination-header-text')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Next'})).not.toBeInTheDocument();
  });
});
