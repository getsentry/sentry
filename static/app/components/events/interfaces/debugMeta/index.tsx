import {createRef, Fragment, PureComponent} from 'react';
import {WithRouterProps} from 'react-router';
import {
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  List,
  ListRowProps,
} from 'react-virtualized';
import styled from '@emotion/styled';

import {openModal, openReprocessEventModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
import {SelectOption, SelectSection} from 'sentry/components/compactSelect';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {getImageRange, parseAddress} from 'sentry/components/events/interfaces/utils';
import PanelTable from 'sentry/components/panels/panelTable';
import {t} from 'sentry/locale';
import DebugMetaStore from 'sentry/stores/debugMetaStore';
import {space} from 'sentry/styles/space';
import {Group, Organization, Project} from 'sentry/types';
import {Image, ImageStatus} from 'sentry/types/debugImage';
import {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';
// eslint-disable-next-line no-restricted-imports
import withSentryRouter from 'sentry/utils/withSentryRouter';

import SearchBarAction from '../searchBarAction';

import Status from './debugImage/status';
import DebugImage from './debugImage';
import layout from './layout';
import {
  combineStatus,
  getFileName,
  IMAGE_AND_CANDIDATE_LIST_MAX_HEIGHT,
  normalizeId,
  shouldSkipSection,
} from './utils';

const IMAGE_INFO_UNAVAILABLE = '-1';

type DefaultProps = {
  data: {
    images: Array<Image | null>;
  };
};

type Images = Array<React.ComponentProps<typeof DebugImage>['image']>;

type Props = DefaultProps &
  WithRouterProps & {
    event: Event;
    organization: Organization;
    projectSlug: Project['slug'];
    groupId?: Group['id'];
  };

type State = {
  filterOptions: SelectSection<string>[];
  filterSelections: SelectOption<string>[];
  filteredImages: Images;
  filteredImagesByFilter: Images;
  filteredImagesBySearch: Images;
  isOpen: boolean;
  scrollbarWidth: number;
  searchTerm: string;
  panelTableHeight?: number;
};

const cache = new CellMeasurerCache({
  fixedWidth: true,
  defaultHeight: 81,
});

class DebugMetaWithRouter extends PureComponent<Props, State> {
  static defaultProps: DefaultProps = {
    data: {images: []},
  };

  state: State = {
    searchTerm: '',
    scrollbarWidth: 0,
    isOpen: false,
    filterOptions: [],
    filterSelections: [],
    filteredImages: [],
    filteredImagesByFilter: [],
    filteredImagesBySearch: [],
  };

  componentDidMount() {
    this.unsubscribeFromDebugMetaStore = DebugMetaStore.listen(
      this.onDebugMetaStoreChange,
      undefined
    );

    cache.clearAll();
    this.getRelevantImages();
    this.openImageDetailsModal();
  }

  componentDidUpdate(prevProps: Props, prevState: State) {
    if (
      this.state.isOpen ||
      (prevState.filteredImages.length === 0 && this.state.filteredImages.length > 0)
    ) {
      this.getPanelBodyHeight();
    }

    this.openImageDetailsModal();

    if (this.props.event?.id !== prevProps.event?.id) {
      this.getRelevantImages();
      this.updateGrid();
    }
  }

  componentWillUnmount() {
    if (this.unsubscribeFromDebugMetaStore) {
      this.unsubscribeFromDebugMetaStore();
    }
  }

  unsubscribeFromDebugMetaStore: any;

  panelTableRef = createRef<HTMLDivElement>();
  listRef: List | null = null;

  onDebugMetaStoreChange = (store: {filter: string}) => {
    const {searchTerm} = this.state;

    if (store.filter !== searchTerm) {
      this.setState(
        {searchTerm: store.filter, isOpen: true},
        this.filterImagesBySearchTerm
      );
    }
  };

  getScrollbarWidth() {
    const panelTableWidth = this.panelTableRef?.current?.clientWidth ?? 0;

    const gridInnerWidth =
      this.panelTableRef?.current?.querySelector(
        '.ReactVirtualized__Grid__innerScrollContainer'
      )?.clientWidth ?? 0;

    const scrollbarWidth = panelTableWidth - gridInnerWidth;

    if (scrollbarWidth !== this.state.scrollbarWidth) {
      this.setState({scrollbarWidth});
    }
  }

  updateGrid = () => {
    if (this.listRef) {
      cache.clearAll();
      this.listRef.forceUpdateGrid();
      this.getScrollbarWidth();
    }
  };

  isValidImage(image: Image | null) {
    // in particular proguard images do not have a code file, skip them
    if (image === null || image.code_file === null || image.type === 'proguard') {
      return false;
    }

    if (getFileName(image.code_file) === 'dyld_sim') {
      // this is only for simulator builds
      return false;
    }

    return true;
  }

  filterImage(image: Image, searchTerm: string) {
    // When searching for an address, check for the address range of the image
    // instead of an exact match.  Note that images cannot be found by index
    // if they are at 0x0.  For those relative addressing has to be used.
    if (searchTerm.indexOf('0x') === 0) {
      const needle = parseAddress(searchTerm);
      if (needle > 0 && image.image_addr !== '0x0') {
        const [startAddress, endAddress] = getImageRange(image as any); // TODO(PRISCILA): remove any
        return needle >= startAddress && needle < endAddress;
      }
    }

    // the searchTerm ending at "!" is the end of the ID search.
    const relMatch = searchTerm.match(/^\s*(.*?)!/); // debug_id!address
    const idSearchTerm = normalizeId(relMatch?.[1] || searchTerm);

    return (
      // Prefix match for identifiers
      normalizeId(image.code_id).indexOf(idSearchTerm) === 0 ||
      normalizeId(image.debug_id).indexOf(idSearchTerm) === 0 ||
      // Any match for file paths
      (image.code_file?.toLowerCase() || '').includes(searchTerm) ||
      (image.debug_file?.toLowerCase() || '').includes(searchTerm)
    );
  }

  filterImagesBySearchTerm() {
    const {filteredImages, filterSelections, searchTerm} = this.state;
    const filteredImagesBySearch = filteredImages.filter(image =>
      this.filterImage(image, searchTerm.toLowerCase())
    );

    const filteredImagesByFilter = this.getFilteredImagesByFilter(
      filteredImagesBySearch,
      filterSelections
    );

    this.setState(
      {
        filteredImagesBySearch,
        filteredImagesByFilter,
      },
      this.updateGrid
    );
  }

  openImageDetailsModal = async () => {
    const {filteredImages} = this.state;

    if (!filteredImages.length) {
      return;
    }

    const {location, organization, projectSlug, groupId, event} = this.props;
    const {query} = location;

    const {imageCodeId, imageDebugId} = query;

    if (!imageCodeId && !imageDebugId) {
      return;
    }

    const image =
      imageCodeId !== IMAGE_INFO_UNAVAILABLE || imageDebugId !== IMAGE_INFO_UNAVAILABLE
        ? filteredImages.find(
            ({code_id, debug_id}) => code_id === imageCodeId || debug_id === imageDebugId
          )
        : undefined;

    const mod = await import(
      'sentry/components/events/interfaces/debugMeta/debugImageDetails'
    );

    const {DebugImageDetails, modalCss} = mod;

    openModal(
      deps => (
        <DebugImageDetails
          {...deps}
          image={image}
          organization={organization}
          projSlug={projectSlug}
          event={event}
          onReprocessEvent={
            defined(groupId) ? this.handleReprocessEvent(groupId) : undefined
          }
        />
      ),
      {
        modalCss,
        onClose: this.handleCloseImageDetailsModal,
      }
    );
  };

  toggleImagesLoaded = () => {
    this.setState(state => ({
      isOpen: !state.isOpen,
    }));
  };

  getPanelBodyHeight() {
    const panelTableHeight = this.panelTableRef?.current?.offsetHeight;

    if (!panelTableHeight) {
      return;
    }

    this.setState({panelTableHeight});
  }

  getRelevantImages() {
    const {data} = this.props;
    const {images} = data;

    // There are a bunch of images in debug_meta that are not relevant to this
    // component. Filter those out to reduce the noise. Most importantly, this
    // includes proguard images, which are rendered separately.

    const relevantImages = images.filter(this.isValidImage);

    if (!relevantImages.length) {
      return;
    }

    const formattedRelevantImages = relevantImages.map(releventImage => {
      const {debug_status, unwind_status} = releventImage as Image;
      return {
        ...releventImage,
        status: combineStatus(debug_status, unwind_status),
      };
    }) as Images;

    // Sort images by their start address. We assume that images have
    // non-overlapping ranges. Each address is given as hex string (e.g.
    // "0xbeef").
    formattedRelevantImages.sort(
      (a, b) => parseAddress(a.image_addr) - parseAddress(b.image_addr)
    );

    const unusedImages: Images = [];

    const usedImages = formattedRelevantImages.filter(image => {
      if (image.debug_status === ImageStatus.UNUSED) {
        unusedImages.push(image as Images[0]);
        return false;
      }
      return true;
    }) as Images;

    const filteredImages = [...usedImages, ...unusedImages];

    const filterOptions = this.getFilterOptions(filteredImages);
    const defaultFilterSelections = (
      'options' in filterOptions[0] ? filterOptions[0].options : []
    ).filter(opt => opt.value !== ImageStatus.UNUSED);

    this.setState({
      filteredImages,
      filterOptions,
      filterSelections: defaultFilterSelections,
      filteredImagesByFilter: this.getFilteredImagesByFilter(
        filteredImages,
        defaultFilterSelections
      ),
      filteredImagesBySearch: filteredImages,
    });
  }

  getFilterOptions(images: Images): SelectSection<string>[] {
    return [
      {
        label: t('Status'),
        options: [...new Set(images.map(image => image.status))].map(status => ({
          value: status,
          textValue: status,
          label: <Status status={status} />,
        })),
      },
    ];
  }

  getFilteredImagesByFilter(
    filteredImages: Images,
    filterOptions: SelectOption<string>[]
  ) {
    const checkedOptions = new Set(filterOptions.map(option => option.value));

    if (![...checkedOptions].length) {
      return filteredImages;
    }

    return filteredImages.filter(image => checkedOptions.has(image.status));
  }

  handleChangeFilter = (filterSelections: SelectOption<string>[]) => {
    const {filteredImagesBySearch} = this.state;
    const filteredImagesByFilter = this.getFilteredImagesByFilter(
      filteredImagesBySearch,
      filterSelections
    );

    this.setState({filterSelections, filteredImagesByFilter}, this.updateGrid);
  };

  handleChangeSearchTerm = (searchTerm = '') => {
    DebugMetaStore.updateFilter(searchTerm);
  };

  handleResetFilter = () => {
    this.setState({filterSelections: []}, this.filterImagesBySearchTerm);
  };

  handleResetSearchBar = () => {
    this.setState(prevState => ({
      searchTerm: '',
      filteredImagesByFilter: prevState.filteredImages,
      filteredImagesBySearch: prevState.filteredImages,
    }));
  };

  handleOpenImageDetailsModal = (
    code_id: Image['code_id'],
    debug_id: Image['debug_id']
  ) => {
    const {location, router} = this.props;

    router.push({
      ...location,
      query: {
        ...location.query,
        imageCodeId: code_id ?? IMAGE_INFO_UNAVAILABLE,
        imageDebugId: debug_id ?? IMAGE_INFO_UNAVAILABLE,
      },
    });
  };

  handleCloseImageDetailsModal = () => {
    const {location, router} = this.props;

    router.push({
      ...location,
      query: {...location.query, imageCodeId: undefined, imageDebugId: undefined},
    });
  };

  handleReprocessEvent = (groupId: Group['id']) => () => {
    const {organization} = this.props;
    openReprocessEventModal({
      organization,
      groupId,
      onClose: this.openImageDetailsModal,
    });
  };

  renderRow = ({index, key, parent, style}: ListRowProps) => {
    const {filteredImagesByFilter: images} = this.state;

    return (
      <CellMeasurer
        cache={cache}
        columnIndex={0}
        key={key}
        parent={parent}
        rowIndex={index}
      >
        <DebugImage
          style={style}
          image={images[index]}
          onOpenImageDetailsModal={this.handleOpenImageDetailsModal}
        />
      </CellMeasurer>
    );
  };

  renderList() {
    const {filteredImagesByFilter: images, panelTableHeight} = this.state;

    if (!panelTableHeight) {
      return images.map((image, index) => (
        <DebugImage
          key={index}
          image={image}
          onOpenImageDetailsModal={this.handleOpenImageDetailsModal}
        />
      ));
    }

    return (
      <AutoSizer disableHeight onResize={this.updateGrid}>
        {({width}) => (
          <StyledList
            ref={(el: List | null) => {
              this.listRef = el;
            }}
            deferredMeasurementCache={cache}
            height={IMAGE_AND_CANDIDATE_LIST_MAX_HEIGHT}
            overscanRowCount={5}
            rowCount={images.length}
            rowHeight={cache.rowHeight}
            rowRenderer={this.renderRow}
            width={width}
            isScrolling={false}
          />
        )}
      </AutoSizer>
    );
  }

  getEmptyMessage() {
    const {searchTerm, filteredImagesByFilter: images, filterSelections} = this.state;

    if (images.length) {
      return {};
    }

    if (searchTerm && !images.length) {
      const hasActiveFilter = filterSelections.length > 0;

      return {
        emptyMessage: t('Sorry, no images match your search query'),
        emptyAction: hasActiveFilter ? (
          <Button onClick={this.handleResetFilter} priority="primary">
            {t('Reset filter')}
          </Button>
        ) : (
          <Button onClick={this.handleResetSearchBar} priority="primary">
            {t('Clear search bar')}
          </Button>
        ),
      };
    }

    return {
      emptyMessage: t('There are no images to be displayed'),
    };
  }

  render() {
    const {
      searchTerm,
      filterOptions,
      scrollbarWidth,
      isOpen,
      filterSelections,
      filteredImagesByFilter: filteredImages,
    } = this.state;
    const {data} = this.props;
    const {images} = data;

    if (shouldSkipSection(filteredImages, images)) {
      return null;
    }

    const showFilters = filterOptions.some(
      section => 'options' in section && section.options.length > 1
    );

    const actions = (
      <ToggleButton onClick={this.toggleImagesLoaded} priority="link">
        {isOpen ? t('Hide Details') : t('Show Details')}
      </ToggleButton>
    );

    return (
      <EventDataSection
        type="images-loaded"
        guideTarget="images-loaded"
        title={t('Images Loaded')}
        help={t(
          'A list of dynamic libraries or shared objects loaded into process memory at the time of the crash. Images contribute application code that is referenced in stack traces.'
        )}
        actions={actions}
      >
        {isOpen && (
          <Fragment>
            <StyledSearchBarAction
              placeholder={t('Search images loaded')}
              onChange={value => this.handleChangeSearchTerm(value)}
              query={searchTerm}
              filterOptions={showFilters ? filterOptions : undefined}
              onFilterChange={this.handleChangeFilter}
              filterSelections={filterSelections}
            />
            <StyledPanelTable
              isEmpty={!filteredImages.length}
              scrollbarWidth={scrollbarWidth}
              headers={[t('Status'), t('Image'), t('Processing'), t('Details'), '']}
              {...this.getEmptyMessage()}
            >
              <div ref={this.panelTableRef}>{this.renderList()}</div>
            </StyledPanelTable>
          </Fragment>
        )}
      </EventDataSection>
    );
  }
}

export const DebugMeta = withSentryRouter(DebugMetaWithRouter);

const StyledPanelTable = styled(PanelTable)<{scrollbarWidth?: number}>`
  overflow: hidden;
  > * {
    :nth-child(-n + 5) {
      ${p => p.theme.overflowEllipsis};
      border-bottom: 1px solid ${p => p.theme.border};
      :nth-child(5n) {
        height: 100%;
        ${p => !p.scrollbarWidth && `display: none`}
      }
    }

    :nth-child(n + 6) {
      grid-column: 1/-1;
      ${p =>
        !p.isEmpty &&
        `
          display: grid;
          padding: 0;
        `}
    }
  }

  ${p => layout(p.theme, p.scrollbarWidth)}
`;

// XXX(ts): Emotion11 has some trouble with List's defaultProps
const StyledList = styled(List as any)<React.ComponentProps<typeof List>>`
  height: auto !important;
  max-height: ${p => p.height}px;
  overflow-y: auto !important;
  outline: none;
`;

const StyledSearchBarAction = styled(SearchBarAction)`
  z-index: 1;
  margin-bottom: ${space(1)};
`;

const ToggleButton = styled(Button)`
  font-weight: 700;
  color: ${p => p.theme.subText};
  &:hover,
  &:focus {
    color: ${p => p.theme.textColor};
  }
`;
