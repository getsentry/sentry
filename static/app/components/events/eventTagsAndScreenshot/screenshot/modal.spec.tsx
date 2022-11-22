import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import {ModalRenderProps} from 'sentry/actionCreators/modal';
import Modal from 'sentry/components/events/eventTagsAndScreenshot/screenshot/modal';
import GroupStore from 'sentry/stores/groupStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {EventAttachment, Project} from 'sentry/types';

const stubEl = (props: {children?: React.ReactNode}) => <div>{props.children}</div>;

function renderModal({
  initialData: {organization, routerContext},
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
      context: routerContext,
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
      organization: TestStubs.Organization({features: ['mobile-screenshot-gallery']}),
      router: {
        params: {orgId: 'org-slug', groupId: 'group-id'},
        location: {query: {types: 'event.screenshot'}},
      },
    } as Parameters<typeof initializeOrg>[0]);
    project = TestStubs.Project();
    ProjectsStore.loadInitialData([project]);
    GroupStore.init();

    getAttachmentsMock = MockApiClient.addMockResponse({
      url: '/issues/group-id/attachments/',
      body: [TestStubs.EventAttachment()],
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
  it('paginates single screenshots correctly', function () {
    const eventAttachment = TestStubs.EventAttachment();
    renderModal({
      eventAttachment,
      initialData,
      projectSlug: project.slug,
      attachmentIndex: 0,
      attachments: [
        eventAttachment,
        TestStubs.EventAttachment({id: '2', event_id: 'new event id'}),
        TestStubs.EventAttachment({id: '3'}),
        TestStubs.EventAttachment({id: '4'}),
        TestStubs.EventAttachment({id: '5'}),
        TestStubs.EventAttachment({id: '6'}),
      ],
      enablePagination: true,
      groupId: 'group-id',
    });
    expect(screen.getByRole('button', {name: 'Previous'})).toBeDisabled();
    userEvent.click(screen.getByRole('button', {name: 'Next'}));

    expect(screen.getByText('new event id')).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Previous'})).toBeEnabled();
  });

  it('fetches a new batch of screenshots correctly', async function () {
    const eventAttachment = TestStubs.EventAttachment();
    renderModal({
      eventAttachment,
      initialData,
      projectSlug: project.slug,
      attachmentIndex: 11,
      attachments: [
        TestStubs.EventAttachment({id: '2'}),
        TestStubs.EventAttachment({id: '3'}),
        TestStubs.EventAttachment({id: '4'}),
        TestStubs.EventAttachment({id: '5'}),
        TestStubs.EventAttachment({id: '6'}),
        TestStubs.EventAttachment({id: '7'}),
        TestStubs.EventAttachment({id: '8'}),
        TestStubs.EventAttachment({id: '9'}),
        TestStubs.EventAttachment({id: '10'}),
        TestStubs.EventAttachment({id: '11'}),
        TestStubs.EventAttachment({id: '12'}),
        eventAttachment,
      ],
      enablePagination: true,
      groupId: 'group-id',
    });
    userEvent.click(screen.getByRole('button', {name: 'Next'}));

    await waitFor(() => {
      expect(getAttachmentsMock).toHaveBeenCalledWith(
        '/issues/group-id/attachments/',
        expect.objectContaining({
          query: expect.objectContaining({cursor: '0:12:0'}),
        })
      );
    });
  });

  it('renders with previous and next buttons when passed attachments and index', function () {
    const eventAttachment = TestStubs.EventAttachment();
    const attachments = [eventAttachment, TestStubs.EventAttachment({id: '2'})];
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
        context: initialData.routerContext,
        organization: initialData.organization,
      }
    );

    expect(screen.getByRole('button', {name: 'Previous'})).toBeDisabled();
    expect(screen.getByTestId('pagination-header-text')).toHaveTextContent('1 of 2');
    userEvent.click(screen.getByRole('button', {name: 'Next'}));
    expect(screen.getByRole('button', {name: 'Next'})).toBeDisabled();
    expect(screen.getByTestId('pagination-header-text')).toHaveTextContent('2 of 2');

    // This pagination doesn't use page links
    expect(getAttachmentsMock).not.toHaveBeenCalled();
  });

  it('does not render pagination buttons when only one screenshot', function () {
    const eventAttachment = TestStubs.EventAttachment();
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
        context: initialData.routerContext,
        organization: initialData.organization,
      }
    );

    expect(screen.queryByRole('button', {name: 'Previous'})).not.toBeInTheDocument();
    expect(screen.queryByTestId('pagination-header-text')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', {name: 'Next'})).not.toBeInTheDocument();
  });
});
