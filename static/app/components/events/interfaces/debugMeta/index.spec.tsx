import type {ComponentProps} from 'react';
import {useVirtualizer} from '@tanstack/react-virtual';
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

import {Container} from '@sentry/scraps/layout';

import {DebugMeta} from 'sentry/components/events/interfaces/debugMeta';
import {
  DebugMetaSearchProvider,
  useDebugMetaSearch,
} from 'sentry/components/events/interfaces/debugMeta/debugMetaSearchContext';
import type {Image} from 'sentry/types/debugImage';
import {ImageStatus} from 'sentry/types/debugImage';

let mockRowSize = 60;

jest.mock('@tanstack/react-virtual', () => {
  return {
    useVirtualizer: jest.fn(({count}: {count: number}) => {
      const virtualItems = Array.from({length: count}, (_, index) => ({
        key: index,
        index,
        start: index * mockRowSize,
        end: (index + 1) * mockRowSize,
        size: mockRowSize,
      }));

      return {
        getVirtualItems: jest.fn(() => virtualItems),
        getTotalSize: jest.fn(() => count * mockRowSize),
        measureElement: jest.fn(),
        measure: jest.fn(),
      };
    }),
  };
});

function DebugMetaSearchButton({searchTerm}: {searchTerm: string}) {
  const {setSearchTerm} = useDebugMetaSearch();

  return (
    <button type="button" onClick={() => setSearchTerm(searchTerm)}>
      Search debug image
    </button>
  );
}

async function openImagesLoaded() {
  await userEvent.click(screen.getByRole('button', {name: 'View Images Loaded Section'}));
}

function DebugMetaWithProvider(props: ComponentProps<typeof DebugMeta>) {
  return (
    <DebugMetaSearchProvider>
      <DebugMeta {...props} />
    </DebugMetaSearchProvider>
  );
}

describe('DebugMeta', () => {
  const {organization, project} = initializeOrg();
  const groupId = undefined;

  beforeEach(() => {
    MockApiClient.clearMockResponses();
    localStorage.clear();
    mockRowSize = 60;
  });

  function makeImages(prefix: string, count: number, overrides: Partial<Image> = {}) {
    return Array.from({length: count}, (_, index) =>
      ImageFixture({
        code_file: `/app/${prefix}-${index}`,
        debug_file: `${prefix}-${index}`,
        image_addr: `0x${(index + 1) * 1000}`,
        ...overrides,
      })
    );
  }

  function makeMostlyUnusedImages() {
    return [
      ...makeImages('used', 3),
      ...makeImages('unused', 5, {debug_status: ImageStatus.UNUSED}),
    ];
  }

  function renderImages(images: Image[]) {
    const eventEntryDebugMeta = {...EntryDebugMetaFixture(), data: {images}};
    const event = EventFixture({entries: [eventEntryDebugMeta]});

    return render(
      <DebugMetaWithProvider
        projectSlug={project.slug}
        event={event}
        data={eventEntryDebugMeta.data}
        groupId={groupId}
      />,
      {organization}
    );
  }

  it('opens details modal', async () => {
    const eventEntryDebugMeta = EntryDebugMetaFixture();
    const event = EventFixture({entries: [eventEntryDebugMeta]});
    const image = eventEntryDebugMeta.data.images![0];
    const mockGetDebug = MockApiClient.addMockResponse({
      url: `/projects/${organization.slug}/${project.slug}/files/dsyms/`,
      method: 'GET',
      body: [],
      match: [
        MockApiClient.matchQuery({debug_id: image?.debug_id, code_id: image?.code_id}),
      ],
    });

    render(
      <DebugMetaWithProvider
        projectSlug={project.slug}
        event={event}
        data={eventEntryDebugMeta.data}
        groupId={groupId}
      />,
      {organization}
    );
    renderGlobalModal();

    expect(screen.getByRole('region', {name: 'Images Loaded'})).toBeInTheDocument();
    const imageName = image?.debug_file!;
    expect(screen.queryByText(imageName)).not.toBeInTheDocument();

    await openImagesLoaded();
    expect(
      await screen.findByRole('button', {name: 'Collapse Images Loaded Section'})
    ).toBeInTheDocument();
    expect(screen.getByText('Ok')).toBeInTheDocument();
    expect(screen.getByText(imageName)).toBeInTheDocument();
    expect(screen.getByText('Symbolication')).toBeInTheDocument();
    expect(mockGetDebug).not.toHaveBeenCalled();

    const codeFile = image?.code_file!;
    expect(screen.queryByText(codeFile)).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'View'}));
    expect(screen.getByText(codeFile)).toBeInTheDocument();
    expect(mockGetDebug).toHaveBeenCalled();
  });

  it('can open debug modal when debug id and code id are missing', async () => {
    const eventEntryDebugMeta = EntryDebugMetaFixture();
    eventEntryDebugMeta.data.images![0] = {
      // Missing both debug_id and code_id
      code_file: '/data/app/code_file/code_file',
      debug_file: '/data/app/debug_file/debug_file',
      image_addr: '0x1337',
      image_size: 123,
      candidates: [],
      debug_status: ImageStatus.MISSING,
      features: {
        ...eventEntryDebugMeta.data.images![0]!.features,
      },
      unwind_status: ImageStatus.MISSING,
      type: 'elf',
    };
    const event = EventFixture({entries: [eventEntryDebugMeta]});

    render(
      <DebugMetaWithProvider
        projectSlug={project.slug}
        event={event}
        data={eventEntryDebugMeta.data}
        groupId={groupId}
      />,
      {organization}
    );
    renderGlobalModal();
    await openImagesLoaded();

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'View'}));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(
      within(screen.getByRole('dialog')).getByText(
        eventEntryDebugMeta.data.images![0].debug_file!
      )
    ).toBeInTheDocument();
  });

  it('searches image contents', async () => {
    const eventEntryDebugMeta = EntryDebugMetaFixture();
    const event = EventFixture({entries: [eventEntryDebugMeta]});
    const image = eventEntryDebugMeta.data.images![0];

    render(
      <DebugMetaWithProvider
        projectSlug={project.slug}
        event={event}
        data={eventEntryDebugMeta.data}
        groupId={groupId}
      />,
      {organization}
    );
    const imageName = image?.debug_file!;
    const codeFile = image?.code_file!;

    expect(
      await screen.findByRole('region', {name: 'Images Loaded'})
    ).toBeInTheDocument();
    await openImagesLoaded();
    const imageNode = screen.getByText(imageName);
    expect(imageNode).toBeInTheDocument();

    const searchBar = screen.getByRole('textbox');
    await userEvent.type(searchBar, 'some jibberish');
    expect(screen.queryByText(imageName)).not.toBeInTheDocument();
    expect(screen.getByText(/no images match your search query/i)).toBeInTheDocument();
    await userEvent.clear(searchBar);
    expect(screen.getByText(imageName)).toBeInTheDocument();
    await userEvent.type(searchBar, codeFile);
    expect(screen.getByText(imageName)).toBeInTheDocument();
  });

  it('filters images', async () => {
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
      <DebugMetaWithProvider
        projectSlug={project.slug}
        event={event}
        data={eventEntryDebugMeta.data}
        groupId={groupId}
      />,
      {organization}
    );

    expect(screen.getByText('Images Loaded')).toBeInTheDocument();
    await openImagesLoaded();
    expect(screen.getByText(firstImage?.debug_file!)).toBeInTheDocument();
    expect(screen.getByText(secondImage?.debug_file)).toBeInTheDocument();

    const filterButton = screen.getByRole('button', {name: '2 Active Filters'});
    expect(filterButton).toBeInTheDocument();
    await userEvent.click(filterButton);
    await userEvent.click(screen.getByRole('option', {name: 'Missing'}));
    expect(screen.getByText(firstImage?.debug_file!)).toBeInTheDocument();
    expect(screen.queryByText(secondImage?.debug_file)).not.toBeInTheDocument();
  });

  it('updates search from shared debug meta context', async () => {
    const firstImage = ImageFixture({
      code_file: '/app/first',
      debug_file: 'first',
      image_addr: '0x1000',
    });
    const secondImage = ImageFixture({
      code_file: '/app/second',
      debug_file: 'second',
      image_addr: '0x2000',
    });
    const eventEntryDebugMeta = {
      ...EntryDebugMetaFixture(),
      data: {
        images: [firstImage, secondImage],
      },
    };

    const event = EventFixture({entries: [eventEntryDebugMeta]});

    render(
      <DebugMetaSearchProvider>
        <DebugMeta
          projectSlug={project.slug}
          event={event}
          data={eventEntryDebugMeta.data}
          groupId={groupId}
        />
        <DebugMetaSearchButton searchTerm={secondImage.code_file!} />
      </DebugMetaSearchProvider>,
      {organization}
    );
    await openImagesLoaded();

    expect(screen.getByText(firstImage.debug_file!)).toBeInTheDocument();
    expect(screen.getByText(secondImage.debug_file!)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'Search debug image'}));

    expect(screen.queryByText(firstImage.debug_file!)).not.toBeInTheDocument();
    expect(screen.getByText(secondImage.debug_file!)).toBeInTheDocument();
  });

  it('renders each image as a row under the column headers', async () => {
    const image = ImageFixture();
    const eventEntryDebugMeta = {
      ...EntryDebugMetaFixture(),
      data: {images: [image]},
    };
    const event = EventFixture({entries: [eventEntryDebugMeta]});

    render(
      <DebugMetaWithProvider
        projectSlug={project.slug}
        event={event}
        data={eventEntryDebugMeta.data}
        groupId={groupId}
      />,
      {organization}
    );
    await openImagesLoaded();

    const table = screen.getByRole('table', {name: 'Images Loaded'});
    const row = within(table).getByRole('row', {name: /Ok/});

    expect(
      within(table)
        .getAllByRole('columnheader')
        .map(header => header.textContent)
    ).toEqual(['Status', 'Image', 'Processing', '']);
    expect(within(row).getAllByRole('cell')).toHaveLength(4);
    expect(within(row).getByText(image.debug_file!)).toBeInTheDocument();
    expect(within(row).getByText('Symbolication')).toBeInTheDocument();
    expect(within(row).getByRole('button', {name: 'View'})).toBeInTheDocument();
  });

  it('uses the table as the virtualizer scroll element', async () => {
    const eventEntryDebugMeta = EntryDebugMetaFixture();
    const event = EventFixture({entries: [eventEntryDebugMeta]});

    render(
      <DebugMetaWithProvider
        projectSlug={project.slug}
        event={event}
        data={eventEntryDebugMeta.data}
        groupId={groupId}
      />,
      {organization}
    );
    await openImagesLoaded();

    expect(jest.mocked(useVirtualizer).mock.lastCall?.[0].getScrollElement()).toBe(
      screen.getByRole('table', {name: 'Images Loaded'})
    );
  });

  it('renders an empty message in the table when no images match the search', async () => {
    const eventEntryDebugMeta = EntryDebugMetaFixture();
    const event = EventFixture({entries: [eventEntryDebugMeta]});

    render(
      <DebugMetaWithProvider
        projectSlug={project.slug}
        event={event}
        data={eventEntryDebugMeta.data}
        groupId={groupId}
      />,
      {organization}
    );
    await openImagesLoaded();

    await userEvent.type(screen.getByRole('textbox'), 'some jibberish');

    const table = screen.getByRole('table', {name: 'Images Loaded'});
    expect(
      within(table).getByText('No images match your search query')
    ).toBeInTheDocument();
    expect(within(table).getByRole('button', {name: 'Reset filter'})).toBeInTheDocument();
  });

  it('keeps the table height locked when the section is collapsed and reopened', async () => {
    const images = Array.from({length: 8}, (_, index) =>
      ImageFixture({
        code_file: `/app/image-${index}`,
        debug_file: `image-${index}`,
        image_addr: `0x${(index + 1) * 1000}`,
      })
    );
    const eventEntryDebugMeta = {...EntryDebugMetaFixture(), data: {images}};
    const event = EventFixture({entries: [eventEntryDebugMeta]});

    render(
      <DebugMetaWithProvider
        projectSlug={project.slug}
        event={event}
        data={eventEntryDebugMeta.data}
        groupId={groupId}
      />,
      {organization}
    );
    await openImagesLoaded();
    await userEvent.type(screen.getByRole('textbox'), 'image-3');
    await userEvent.click(
      screen.getByRole('button', {name: 'Collapse Images Loaded Section'})
    );
    await openImagesLoaded();

    const table = screen.getByRole('table', {name: 'Images Loaded'});
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(table).toHaveStyle({height: '440px'});
  });

  it('locks the table height when the search is set before the collapsed section is expanded', async () => {
    const images = Array.from({length: 8}, (_, index) =>
      ImageFixture({
        code_file: `/app/image-${index}`,
        debug_file: `image-${index}`,
        image_addr: `0x${(index + 1) * 1000}`,
      })
    );
    const eventEntryDebugMeta = {...EntryDebugMetaFixture(), data: {images}};
    const event = EventFixture({entries: [eventEntryDebugMeta]});

    render(
      <DebugMetaSearchProvider>
        <DebugMeta
          projectSlug={project.slug}
          event={event}
          data={eventEntryDebugMeta.data}
          groupId={groupId}
        />
        <DebugMetaSearchButton searchTerm="image-3" />
      </DebugMetaSearchProvider>,
      {organization}
    );
    await userEvent.click(screen.getByRole('button', {name: 'Search debug image'}));
    await openImagesLoaded();

    const table = screen.getByRole('table', {name: 'Images Loaded'});
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(table).toHaveStyle({height: '440px'});

    await userEvent.clear(screen.getByRole('textbox'));
    expect(within(table).getAllByRole('row')).toHaveLength(9);
    expect(table).toHaveStyle({height: '440px'});
  });

  it('does not lock the table height when the default filter leaves few images', async () => {
    renderImages(makeMostlyUnusedImages());
    await openImagesLoaded();

    const table = screen.getByRole('table', {name: 'Images Loaded'});
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    expect(table).not.toHaveStyle({height: '440px'});
  });

  it('does not lock the table height when the section is already open on load and the default filter leaves few images', async () => {
    const images = makeMostlyUnusedImages();
    const {unmount} = renderImages(images);
    await openImagesLoaded();
    unmount();

    renderImages(images);

    const table = await screen.findByRole('table', {name: 'Images Loaded'});
    expect(within(table).getAllByRole('row')).toHaveLength(4);
    expect(table).not.toHaveStyle({height: '440px'});
  });

  it('locks the table height when the measured rows are taller than the estimate', async () => {
    mockRowSize = 150;
    renderImages(makeImages('image', 3));
    await openImagesLoaded();
    await userEvent.type(screen.getByRole('textbox'), 'image-1');

    const table = screen.getByRole('table', {name: 'Images Loaded'});
    expect(within(table).getAllByRole('row')).toHaveLength(2);
    expect(table).toHaveStyle({height: '440px'});
  });

  describe('responsive columns', () => {
    const renderAtContainerWidth = async (width: number) => {
      jest.spyOn(Element.prototype, 'clientWidth', 'get').mockReturnValue(width);
      const eventEntryDebugMeta = EntryDebugMetaFixture();
      const event = EventFixture({entries: [eventEntryDebugMeta]});

      render(
        <Container containerType="inline-size">
          <DebugMetaWithProvider
            projectSlug={project.slug}
            event={event}
            data={eventEntryDebugMeta.data}
            groupId={groupId}
          />
        </Container>,
        {organization}
      );
      await openImagesLoaded();

      return screen.getByRole('table', {name: 'Images Loaded'}).style.gridTemplateColumns;
    };

    afterEach(() => {
      jest.restoreAllMocks();
    });

    it('drops the Processing column when the container is narrower than lg', async () => {
      expect(await renderAtContainerWidth(300)).toBe('0.6fr 1.5fr 0.6fr');
    });

    it('shows the Processing column when the container is at least lg', async () => {
      expect(await renderAtContainerWidth(1200)).toBe('0.6fr 2fr 1fr 0.4fr');
    });
  });

  it('skips section when only sdk__info is present', () => {
    const eventEntryDebugMeta = EntryDebugMetaFixture();
    eventEntryDebugMeta.data.images = undefined;
    eventEntryDebugMeta.data.sdk_info = {
      sdk_name: 'ios',
      version_major: 16,
      version_minor: 3,
      version_patchlevel: 1,
    };
    const event = EventFixture({entries: [eventEntryDebugMeta]});

    const {container} = render(
      <DebugMetaWithProvider
        projectSlug={project.slug}
        event={event}
        data={eventEntryDebugMeta.data}
        groupId={groupId}
      />,
      {organization}
    );

    expect(container).toBeEmptyDOMElement();
  });
});
