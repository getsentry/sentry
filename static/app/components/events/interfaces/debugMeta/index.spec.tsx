import {EventFixture} from 'sentry-fixture/event';
import {EntryDebugMetaFixture} from 'sentry-fixture/eventEntry';
import {ImageFixture} from 'sentry-fixture/image';

import {initializeOrg} from 'sentry-test/initializeOrg';
import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  within,
} from 'sentry-test/reactTestingLibrary';

import {DebugMeta} from 'sentry/components/events/interfaces/debugMeta';
import ModalStore from 'sentry/stores/modalStore';
import {ImageStatus} from 'sentry/types/debugImage';

describe('DebugMeta', function () {
  const {organization, project} = initializeOrg();

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ModalStore.reset();
  });

  it('opens details modal', async function () {
    const eventEntryDebugMeta = EntryDebugMetaFixture();
    const event = EventFixture({entries: [eventEntryDebugMeta]});
    const image = eventEntryDebugMeta.data.images[0];
    const mockGetDebug = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/files/dsyms/?debug_id=${image?.debug_id}`,
      method: 'GET',
      body: [],
    });

    render(
      <DebugMeta
        projectSlug={project.slug}
        event={event}
        data={eventEntryDebugMeta.data}
      />,
      {organization}
    );
    renderGlobalModal();

    screen.getByRole('heading', {name: 'Images Loaded'});
    const imageName = image?.debug_file as string;
    expect(screen.queryByText(imageName)).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Show Details'}));
    expect(screen.getByText('Ok')).toBeInTheDocument();
    expect(screen.getByText(imageName)).toBeInTheDocument();
    expect(screen.getByText('Symbolication')).toBeInTheDocument();
    expect(mockGetDebug).not.toHaveBeenCalled();

    const codeFile = image?.code_file as string;
    expect(screen.queryByText(codeFile)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'View'}));
    expect(screen.getByText(codeFile)).toBeInTheDocument();
    expect(mockGetDebug).toHaveBeenCalled();
  });

  it('can open debug modal when debug id and code id are missing', async function () {
    const eventEntryDebugMeta = EntryDebugMetaFixture();
    eventEntryDebugMeta.data.images[0] = {
      // Missing both debug_id and code_id
      code_file: '/data/app/code_file/code_file',
      debug_file: '/data/app/debug_file/debug_file',
      image_addr: '0x1337',
      image_size: 123,
      candidates: [],
      debug_status: ImageStatus.MISSING,
      features: {
        ...eventEntryDebugMeta.data.images[0]!.features,
      },
      unwind_status: ImageStatus.MISSING,
      type: 'elf',
    };
    const event = EventFixture({entries: [eventEntryDebugMeta]});

    render(
      <DebugMeta
        projectSlug={project.slug}
        event={event}
        data={eventEntryDebugMeta.data}
      />,
      {organization}
    );
    renderGlobalModal();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'Show Details'}));
    await userEvent.click(screen.getByRole('button', {name: 'View'}));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(
      within(screen.getByRole('dialog')).getByText(
        eventEntryDebugMeta.data.images[0].debug_file!
      )
    ).toBeInTheDocument();
  });

  it('searches image contents', async function () {
    const eventEntryDebugMeta = EntryDebugMetaFixture();
    const event = EventFixture({entries: [eventEntryDebugMeta]});
    const image = eventEntryDebugMeta.data.images[0];

    render(
      <DebugMeta
        projectSlug={project.slug}
        event={event}
        data={eventEntryDebugMeta.data}
      />,
      {organization}
    );
    const imageName = image?.debug_file as string;
    const codeFile = image?.code_file as string;

    screen.getByRole('heading', {name: 'Images Loaded'});
    await userEvent.click(screen.getByRole('button', {name: 'Show Details'}));
    const imageNode = screen.getByText(imageName);
    expect(imageNode).toBeInTheDocument();

    const searchBar = screen.getByRole('textbox');
    await userEvent.type(searchBar, 'some jibberish');
    expect(screen.queryByText(imageName)).not.toBeInTheDocument();
    expect(
      screen.getByText('Sorry, no images match your search query')
    ).toBeInTheDocument();
    await userEvent.clear(searchBar);
    expect(screen.getByText(imageName)).toBeInTheDocument();
    await userEvent.type(searchBar, codeFile);
    expect(screen.getByText(imageName)).toBeInTheDocument();
  });

  it('filters images', async function () {
    const firstImage = ImageFixture();
    const secondImage = {
      ...ImageFixture(),
      debug_status: ImageStatus.MISSING,
      debug_file: 'test_file',
      code_file: '/Users/foo/Coding/sentry-native/build/./test_file',
    };
    const eventEntryDebugMeta = {
      ...EntryDebugMetaFixture(),
      data: {
        images: [firstImage, secondImage],
      },
    };

    const event = EventFixture({entries: [eventEntryDebugMeta]});

    render(
      <DebugMeta
        projectSlug={project.slug}
        event={event}
        data={eventEntryDebugMeta.data}
      />,
      {organization}
    );

    screen.getByRole('heading', {name: 'Images Loaded'});
    await userEvent.click(screen.getByRole('button', {name: 'Show Details'}));
    expect(screen.getByText(firstImage?.debug_file as string)).toBeInTheDocument();
    expect(screen.getByText(secondImage?.debug_file)).toBeInTheDocument();

    const filterButton = screen.getByRole('button', {name: '2 Active Filters'});
    expect(filterButton).toBeInTheDocument();
    await userEvent.click(filterButton);
    await userEvent.click(screen.getByRole('option', {name: 'Missing'}));
    expect(screen.getByText(firstImage?.debug_file as string)).toBeInTheDocument();
    expect(screen.queryByText(secondImage?.debug_file)).not.toBeInTheDocument();
  });
});
