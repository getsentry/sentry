import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useState,
} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useVirtualizer} from '@tanstack/react-virtual';

import {openModal, openReprocessEventModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/core/button';
import type {SelectOption, SelectSection} from 'sentry/components/core/compactSelect';
import {Container, Flex, Grid} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text';
import {
  DebugImageDetails,
  modalCss,
} from 'sentry/components/events/interfaces/debugMeta/debugImageDetails';
import SearchBarAction from 'sentry/components/events/interfaces/searchBarAction';
import {getImageRange, parseAddress} from 'sentry/components/events/interfaces/utils';
import {t} from 'sentry/locale';
import DebugMetaStore from 'sentry/stores/debugMetaStore';
import type {Image, ImageWithCombinedStatus} from 'sentry/types/debugImage';
import {ImageStatus} from 'sentry/types/debugImage';
import type {EntryDebugMeta, Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import useOrganization from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

import Status from './debugImage/status';
import DebugImage from './debugImage';
import {combineStatus, getFileName, normalizeId} from './utils';

const ROW_HEIGHT = 45;
const MAX_HEIGHT = 400;

function shouldSkipSection(
  filteredImages: Image[],
  images: EntryDebugMeta['data']['images']
) {
  if (filteredImages.length) {
    return false;
  }
  const definedImages = images?.filter(image => defined(image));
  if (!definedImages?.length) {
    return true;
  }
  return definedImages.every(image => image.type === 'proguard');
}

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
  const theme = useTheme();
  const organization = useOrganization();

  const [scrollContainer, setScrollContainer] = useState<HTMLDivElement | null>(null);
  const [filterSelections, setFilterSelections] = useState<FilterSelections>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filtersInitialized, setFiltersInitialized] = useState(false);
  const [lockHeight, setLockHeight] = useState(false);

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

  useEffect(() => {
    const unsubscribe = DebugMetaStore.listen((store: {filter: string}) => {
      setSearchTerm(store.filter);
    }, undefined);
    return () => unsubscribe();
  }, []);

  const filteredImages = useMemo(
    () => filterImages(allImages, filterSelections, searchTerm),
    [allImages, filterSelections, searchTerm]
  );

  const virtualizer = useVirtualizer({
    count: filteredImages.length,
    getScrollElement: () => scrollContainer,
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
    [event, groupId, organization, projectSlug, theme]
  );

  if (shouldSkipSection(filteredImages, data.images)) {
    return null;
  }

  const showFilters = filterOptions.some(s => 'options' in s && s.options.length > 1);

  return (
    <InterimSection
      type={SectionKey.DEBUGMETA}
      title={t('Images Loaded')}
      help={t(
        'A list of dynamic libraries or shared objects loaded into process memory at the time of the crash.'
      )}
      initialCollapse
    >
      <Fragment>
        <SearchBarAction
          placeholder={t('Search images')}
          onChange={v => DebugMetaStore.updateFilter(v)}
          query={searchTerm}
          filterOptions={showFilters ? filterOptions : undefined}
          onFilterChange={setFilterSelections}
          filterSelections={filterSelections}
        />
        <Container border="primary" radius="md" overflow="hidden" marginTop="sm">
          <Header
            columns={{
              '2xs': '0.6fr 1.5fr 0.6fr',
              xs: '0.6fr 2fr 0.6fr',
              sm: '0.6fr 2fr 1fr 0.4fr',
            }}
            background="secondary"
            borderBottom="primary"
          >
            <Flex align="center" minWidth="0" padding="md lg">
              {t('Status')}
            </Flex>
            <Flex align="center" minWidth="0" paddingTop="md" paddingBottom="md">
              {t('Image')}
            </Flex>
            <Flex
              align="center"
              display={{'2xs': 'none', xs: 'none'}}
              minWidth="0"
              paddingTop="md"
              paddingBottom="md"
            >
              {t('Processing')}
            </Flex>
            <div />
          </Header>
          {filteredImages.length ? (
            <ScrollArea
              ref={setScrollContainer}
              style={{height: lockHeight ? MAX_HEIGHT : undefined, maxHeight: MAX_HEIGHT}}
            >
              <div style={{height: totalSize, position: 'relative'}}>
                {virtualizer.getVirtualItems().map(row => (
                  <div
                    key={row.key}
                    ref={virtualizer.measureElement}
                    data-index={row.index}
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
                      isLast={row.index === filteredImages.length - 1}
                      onOpenImageDetailsModal={openDetails}
                    />
                  </div>
                ))}
              </div>
            </ScrollArea>
          ) : (
            <Flex
              direction="column"
              align="center"
              justify="center"
              gap="md"
              padding="lg"
              style={lockHeight ? {height: MAX_HEIGHT} : undefined}
            >
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
            </Flex>
          )}
        </Container>
      </Fragment>
    </InterimSection>
  );
}

const Header = styled(Grid)`
  font-size: ${p => p.theme.font.size.sm};
  font-weight: ${p => p.theme.font.weight.sans.medium};
  color: ${p => p.theme.tokens.content.secondary};
  text-transform: uppercase;
`;

const ScrollArea = styled('div')`
  overflow-y: auto;
`;
