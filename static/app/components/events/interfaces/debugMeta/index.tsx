import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import {useTheme} from '@emotion/react';
import {useVirtualizer} from '@tanstack/react-virtual';

import {Button} from '@sentry/scraps/button';
import type {SelectOption, SelectSection} from '@sentry/scraps/compactSelect';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {useModal} from '@sentry/scraps/modal';
import {Table, type TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {openReprocessEventModal} from 'sentry/actionCreators/modal';
import {
  DebugImageDetails,
  modalCss,
} from 'sentry/components/events/interfaces/debugMeta/debugImageDetails';
import {useDebugMetaSearch} from 'sentry/components/events/interfaces/debugMeta/debugMetaSearchContext';
import {SearchBarAction} from 'sentry/components/events/interfaces/searchBarAction';
import {getImageRange, parseAddress} from 'sentry/components/events/interfaces/utils';
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

const ROW_HEIGHT = 45;
const MAX_HEIGHT = 400;
const TABLE_COLUMNS: TableColumnConfig[] = [
  {key: 'status', width: '0.6fr', resizable: false},
  {key: 'image', width: '2fr', resizable: false},
  {key: 'processing', width: '1fr', resizable: false},
  {key: 'actions', width: '0.4fr', resizable: false},
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

  const tableRef = useRef<HTMLTableElement>(null);
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
    setFilterSelections(defaults);
    setFiltersInitialized(true);
  }, [filterOptions, filtersInitialized]);

  const filteredImages = useMemo(
    () => filterImages(allImages, filterSelections, searchTerm),
    [allImages, filterSelections, searchTerm]
  );

  const virtualizer = useVirtualizer({
    count: filteredImages.length,
    getScrollElement: () => tableRef.current,
    estimateSize: () => ROW_HEIGHT,
    overscan: 5,
  });

  const totalSize = virtualizer.getTotalSize();
  useLayoutEffect(() => {
    if (!lockHeight && totalSize > MAX_HEIGHT) {
      setLockHeight(true);
    }
  }, [totalSize, lockHeight]);

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
      <Fragment>
        <SearchBarAction
          placeholder={t('Search images')}
          onChange={setSearchTerm}
          query={searchTerm}
          filterOptions={showFilters ? filterOptions : undefined}
          onFilterChange={setFilterSelections}
          filterSelections={filterSelections}
        />
        <Container border="primary" radius="md" overflowX="auto" marginTop="sm">
          <Table
            ref={tableRef}
            columns={TABLE_COLUMNS}
            style={{
              width: '100%',
              minWidth: 800,
              overflowY: 'auto',
              height: lockHeight ? MAX_HEIGHT + ROW_HEIGHT : undefined,
              maxHeight: MAX_HEIGHT + ROW_HEIGHT,
            }}
          >
            <Table.Head sticky>
              <Table.Row>
                <Flex
                  as="th"
                  role="columnheader"
                  align="center"
                  padding="md lg"
                  background="secondary"
                  borderBottom="primary"
                >
                  <Text size="sm" variant="muted" bold uppercase>
                    {t('Status')}
                  </Text>
                </Flex>
                <Flex
                  as="th"
                  role="columnheader"
                  align="center"
                  padding="md lg"
                  background="secondary"
                  borderBottom="primary"
                >
                  <Text size="sm" variant="muted" bold uppercase>
                    {t('Image')}
                  </Text>
                </Flex>
                <Flex
                  as="th"
                  role="columnheader"
                  align="center"
                  padding="md lg"
                  background="secondary"
                  borderBottom="primary"
                >
                  <Text size="sm" variant="muted" bold uppercase>
                    {t('Processing')}
                  </Text>
                </Flex>
                <Flex
                  as="th"
                  role="columnheader"
                  background="secondary"
                  borderBottom="primary"
                />
              </Table.Row>
            </Table.Head>
            {filteredImages.length ? (
              <Table.Body style={{height: totalSize, position: 'relative'}}>
                {virtualizer.getVirtualItems().map(row => (
                  <Table.Row
                    key={row.key}
                    ref={virtualizer.measureElement}
                    data-index={row.index}
                    divider={row.index !== filteredImages.length - 1}
                    style={{
                      position: 'absolute',
                      top: 0,
                      left: 0,
                      width: '100%',
                      transform: `translateY(${row.start}px)`,
                    }}
                  >
                    <DebugImage
                      image={filteredImages[row.index]!}
                      onOpenImageDetailsModal={openDetails}
                    />
                  </Table.Row>
                ))}
              </Table.Body>
            ) : (
              <Table.StatusBody style={lockHeight ? {height: MAX_HEIGHT} : undefined}>
                <Stack align="center" justify="center" gap="md" padding="lg">
                  <Text align="center" variant="muted">
                    {searchTerm
                      ? t('No images match your search query')
                      : t('There are no images to be displayed')}
                  </Text>
                  {searchTerm && (
                    <Button
                      size="sm"
                      onClick={() =>
                        filterSelections.length
                          ? setFilterSelections([])
                          : setSearchTerm('')
                      }
                    >
                      {filterSelections.length ? t('Reset filter') : t('Clear search')}
                    </Button>
                  )}
                </Stack>
              </Table.StatusBody>
            )}
          </Table>
        </Container>
      </Fragment>
    </FoldSection>
  );
}
