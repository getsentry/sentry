import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {useTheme} from '@emotion/react';

import {Button} from '@sentry/scraps/button';
import type {SelectOption, SelectSection} from '@sentry/scraps/compactSelect';
import {Stack} from '@sentry/scraps/layout';
import {useModal} from '@sentry/scraps/modal';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {openReprocessEventModal} from 'sentry/actionCreators/modal';
import {
  DebugImageDetails,
  modalCss,
} from 'sentry/components/events/interfaces/debugMeta/debugImageDetails';
import {useDebugMetaSearch} from 'sentry/components/events/interfaces/debugMeta/debugMetaSearchContext';
import {SearchBarAction} from 'sentry/components/events/interfaces/searchBarAction';
import {getImageRange, parseAddress} from 'sentry/components/events/interfaces/utils';
import {
  SIMPLE_TABLE_HEADER_ROW_HEIGHT,
  SimpleTable,
} from 'sentry/components/tables/simpleTable';
import {useVirtualRows} from 'sentry/components/tables/useVirtualRows';
import {t} from 'sentry/locale';
import type {Image, ImageWithCombinedStatus} from 'sentry/types/debugImage';
import {ImageStatus} from 'sentry/types/debugImage';
import type {EntryDebugMeta, Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils/defined';
import {useOrganization} from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';

import {Status} from './debugImage/status';
import {DebugImage} from './debugImage';
import {combineStatus, getFileName, normalizeId} from './utils';

const ROW_HEIGHT = 61;
const MAX_BODY_HEIGHT = 400;
const MAX_TABLE_HEIGHT = MAX_BODY_HEIGHT + SIMPLE_TABLE_HEADER_ROW_HEIGHT.default;

const COLUMNS: TableColumnConfig[] = [
  {key: 'status', width: '0.6fr'},
  {key: 'image', width: {zero: '1.5fr', sm: '2fr'}},
  {key: 'processing', visible: {lg: true}, width: '1fr'},
  {key: 'actions', width: {zero: '0.6fr', lg: '0.4fr'}},
];

function filterImages(
  images: ImageWithCombinedStatus[],
  filterSelections: Array<SelectOption<string>>,
  searchTerm: string
) {
  const selections = new Set(filterSelections.map(option => option.value));
  let result = images;

  if (selections.size > 0) {
    result = result.filter(image => selections.has(image.status));
  }

  if (searchTerm) {
    const term = searchTerm.toLowerCase();
    result = result.filter(image => {
      // When searching for an address, check for the address range of the image
      // instead of an exact match.  Note that images cannot be found by index
      // if they are at 0x0.  For those relative addressing has to be used.
      if (term.startsWith('0x')) {
        const needle = parseAddress(term);
        if (needle > 0 && image.image_addr !== '0x0') {
          const [startAddress, endAddress] = getImageRange(image);
          return needle >= startAddress! && needle < endAddress!;
        }
      }
      // the searchTerm ending at "!" is the end of the ID search.
      const relMatch = term.match(/^\s*(.*?)!/);
      const idTerm = normalizeId(relMatch?.[1] || term);
      return (
        // Prefix match for identifiers
        normalizeId(image.code_id).startsWith(idTerm) ||
        normalizeId(image.debug_id).startsWith(idTerm) ||
        // Any match for file paths
        (image.code_file?.toLowerCase() || '').includes(term) ||
        (image.debug_file?.toLowerCase() || '').includes(term)
      );
    });
  }

  return result;
}

interface DebugMetaProps {
  data: EntryDebugMeta['data'];
  event: Event;
  groupId: Group['id'] | undefined;
  projectSlug: Project['slug'];
}

type FilterSelections = Array<SelectOption<string>>;

export function DebugMeta({data, projectSlug, groupId, event}: DebugMetaProps) {
  const {openModal} = useModal();

  const theme = useTheme();
  const organization = useOrganization();

  const [filterSelections, setFilterSelections] = useState<FilterSelections>([]);
  const [filtersInitialized, setFiltersInitialized] = useState(false);
  const [lockHeight, setLockHeight] = useState(false);
  const {searchTerm, setSearchTerm} = useDebugMetaSearch();

  const {allImages, filterOptions} = useMemo(() => {
    const relevant = data.images?.filter((image): image is Image => {
      if (!image?.code_file || image.type === 'proguard') {
        return false;
      }
      if (getFileName(image.code_file) === 'dyld_sim') {
        return false;
      }
      return true;
    });

    if (!relevant?.length) {
      return {allImages: [], filterOptions: []};
    }

    const formatted = relevant
      .map<ImageWithCombinedStatus>(img => ({
        ...img,
        status: combineStatus(img.debug_status, img.unwind_status),
      }))
      .sort((a, b) => parseAddress(a.image_addr) - parseAddress(b.image_addr));

    const used = formatted.filter(img => img.debug_status !== ImageStatus.UNUSED);
    const unused = formatted.filter(img => img.debug_status === ImageStatus.UNUSED);
    const all = [...used, ...unused];

    const statuses = [...new Set(all.map(img => img.status))];
    const options: Array<SelectSection<string>> = [
      {
        label: t('Status'),
        options: statuses.map(status => ({
          value: status,
          textValue: status,
          label: <Status status={status} />,
        })),
      },
    ];

    return {allImages: all, filterOptions: options};
  }, [data.images]);

  useEffect(() => {
    if (filtersInitialized || !filterOptions.length) {
      return;
    }

    const defaults = (
      'options' in filterOptions[0]! ? filterOptions[0].options : []
    ).filter(opt => opt.value !== ImageStatus.UNUSED);
    // oxlint-disable-next-line react/set-state-in-effect
    setFilterSelections(defaults);
    setFiltersInitialized(true);
  }, [filterOptions, filtersInitialized]);

  const filteredImages = useMemo(
    () => filterImages(allImages, filterSelections, searchTerm),
    [allImages, filterSelections, searchTerm]
  );

  const filtersReady = filtersInitialized || !filterOptions.length;

  if (
    filtersReady &&
    !lockHeight &&
    filteredImages.length * ROW_HEIGHT > MAX_BODY_HEIGHT
  ) {
    setLockHeight(true);
  }

  const lockTableHeight = useCallback(() => {
    if (filtersReady) {
      setLockHeight(true);
    }
  }, [filtersReady]);

  const openDetails = useCallback(
    (image: ImageWithCombinedStatus) => {
      openModal(
        deps => (
          <DebugImageDetails
            {...deps}
            image={image}
            organization={organization}
            projSlug={projectSlug}
            event={event}
            onReprocessEvent={
              defined(groupId)
                ? () => openReprocessEventModal({organization, groupId})
                : undefined
            }
          />
        ),
        {modalCss: modalCss(theme)}
      );
    },
    [event, groupId, organization, projectSlug, theme, openModal]
  );

  if (!allImages.length) {
    return null;
  }

  const showFilters = filterOptions.some(s => 'options' in s && s.options.length > 1);

  return (
    <FoldSection
      sectionKey={SectionKey.DEBUGMETA}
      title={t('Images Loaded')}
      initialCollapse
    >
      <Stack gap="sm">
        <SearchBarAction
          placeholder={t('Search images')}
          onChange={setSearchTerm}
          query={searchTerm}
          filterOptions={showFilters ? filterOptions : undefined}
          onFilterChange={setFilterSelections}
          filterSelections={filterSelections}
        />
        <DebugImagesTable
          images={filteredImages}
          lockHeight={lockHeight}
          onExceedMaxHeight={lockTableHeight}
          onOpenImageDetailsModal={openDetails}
          emptyState={
            <Stack align="center" gap="md">
              <Text align="center" variant="muted">
                {searchTerm
                  ? t('No images match your search query')
                  : t('There are no images to be displayed')}
              </Text>
              {searchTerm && (
                <Button
                  size="sm"
                  onClick={() =>
                    filterSelections.length ? setFilterSelections([]) : setSearchTerm('')
                  }
                >
                  {filterSelections.length ? t('Reset filter') : t('Clear search')}
                </Button>
              )}
            </Stack>
          }
        />
      </Stack>
    </FoldSection>
  );
}

interface DebugImagesTableProps {
  emptyState: ReactNode;
  images: ImageWithCombinedStatus[];
  lockHeight: boolean;
  onExceedMaxHeight: () => void;
  onOpenImageDetailsModal: (image: ImageWithCombinedStatus) => void;
}

function DebugImagesTable({
  emptyState,
  images,
  lockHeight,
  onExceedMaxHeight,
  onOpenImageDetailsModal,
}: DebugImagesTableProps) {
  const tableRef = useRef<HTMLTableElement>(null);

  const {paddingBottom, paddingTop, totalSize, virtualItems, virtualizer} =
    useVirtualRows({
      count: images.length,
      getScrollElement: () => tableRef.current,
      estimateSize: () => ROW_HEIGHT,
    });

  useLayoutEffect(() => {
    if (!lockHeight && totalSize > MAX_BODY_HEIGHT) {
      onExceedMaxHeight();
    }
  }, [totalSize, lockHeight, onExceedMaxHeight]);

  return (
    <SimpleTable
      aria-label={t('Images Loaded')}
      columns={COLUMNS}
      customSections
      maxHeight={`${MAX_TABLE_HEIGHT}px`}
      ref={tableRef}
      scrollable
      style={lockHeight ? {height: MAX_TABLE_HEIGHT} : undefined}
    >
      <SimpleTable.Head sticky>
        <SimpleTable.HeaderRow>
          <SimpleTable.HeaderCell>{t('Status')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Image')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Processing')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell />
        </SimpleTable.HeaderRow>
      </SimpleTable.Head>
      {images.length ? (
        <SimpleTable.Body style={{alignContent: 'start', paddingBottom, paddingTop}}>
          {virtualItems.map(row => (
            <DebugImage
              key={row.key}
              ref={virtualizer.measureElement}
              data-index={row.index}
              image={images[row.index]!}
              onOpenImageDetailsModal={onOpenImageDetailsModal}
            />
          ))}
        </SimpleTable.Body>
      ) : (
        <SimpleTable.Body>
          <SimpleTable.Empty>{emptyState}</SimpleTable.Empty>
        </SimpleTable.Body>
      )}
    </SimpleTable>
  );
}
