import React from 'react';
import {withRouter} from 'react-router';
import {WithRouterProps} from 'react-router/lib/withRouter';
import {
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  List,
  ListRowProps,
} from 'react-virtualized';
import styled from '@emotion/styled';

import {openModal, openReprocessEventModal} from 'app/actionCreators/modal';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import Button from 'app/components/button';
import EventDataSection from 'app/components/events/eventDataSection';
import {getImageRange, parseAddress} from 'app/components/events/interfaces/utils';
import {PanelTable} from 'app/components/panels';
import QuestionTooltip from 'app/components/questionTooltip';
import SearchBar from 'app/components/searchBar';
import {t} from 'app/locale';
import DebugMetaStore, {DebugMetaActions} from 'app/stores/debugMetaStore';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Group, Organization, Project} from 'app/types';
import {Image, ImageStatus} from 'app/types/debugImage';
import {Event} from 'app/types/event';
import {defined} from 'app/utils';

import Status from './debugImage/status';
import DebugImage from './debugImage';
import Filter from './filter';
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

type FilterOptions = React.ComponentProps<typeof Filter>['options'];
type Images = Array<React.ComponentProps<typeof DebugImage>['image']>;

type Props = DefaultProps &
  WithRouterProps & {
    event: Event;
    organization: Organization;
    projectId: Project['id'];
    groupId?: Group['id'];
  };

type State = {
  searchTerm: string;
  filteredImages: Images;
  filteredImagesBySearch: Images;
  filteredImagesByFilter: Images;
  filterOptions: FilterOptions;
  scrollbarWidth: number;
  panelTableHeight?: number;
};

const cache = new CellMeasurerCache({
  fixedWidth: true,
  defaultHeight: 81,
});

class DebugMeta extends React.PureComponent<Props, State> {
  static defaultProps: DefaultProps = {
    data: {images: []},
  };

  state: State = {
    searchTerm: '',
    scrollbarWidth: 0,
    filterOptions: {},
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

  componentDidUpdate(_prevProps: Props, prevState: State) {
    if (prevState.filteredImages.length === 0 && this.state.filteredImages.length > 0) {
      this.getPanelBodyHeight();
    }

    this.openImageDetailsModal();
  }

  componentWillUnmount() {
    if (this.unsubscribeFromDebugMetaStore) {
      this.unsubscribeFromDebugMetaStore();
    }
  }

  unsubscribeFromDebugMetaStore: any;

  panelTableRef = React.createRef<HTMLDivElement>();
  listRef: List | null = null;

  onDebugMetaStoreChange = (store: {filter: string}) => {
    const {searchTerm} = this.state;

    if (store.filter !== searchTerm) {
      this.setState({searchTerm: store.filter}, this.filterImagesBySearchTerm);
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
      (image.code_file?.toLowerCase() || '').indexOf(searchTerm) >= 0 ||
      (image.debug_file?.toLowerCase() || '').indexOf(searchTerm) >= 0
    );
  }

  filterImagesBySearchTerm() {
    const {filteredImages, filterOptions, searchTerm} = this.state;
    const filteredImagesBySearch = filteredImages.filter(image =>
      this.filterImage(image, searchTerm.toLowerCase())
    );

    const filteredImagesByFilter = this.getFilteredImagesByFilter(
      filteredImagesBySearch,
      filterOptions
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

    const {location, organization, projectId, groupId, event} = this.props;
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
      /* webpackChunkName: "DebugImageDetails" */ 'app/components/events/interfaces/debugMeta-v2/debugImageDetails'
    );

    const {default: Modal, modalCss} = mod;

    openModal(
      deps => (
        <Modal
          {...deps}
          image={image}
          organization={organization}
          projectId={projectId}
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

  getPanelBodyHeight() {
    const panelTableHeight = this.panelTableRef?.current?.offsetHeight;

    if (!panelTableHeight) {
      return;
    }

    this.setState({panelTableHeight});
  }

  getListHeight() {
    const {panelTableHeight} = this.state;

    if (!panelTableHeight || panelTableHeight > IMAGE_AND_CANDIDATE_LIST_MAX_HEIGHT) {
      return IMAGE_AND_CANDIDATE_LIST_MAX_HEIGHT;
    }

    return panelTableHeight;
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

    this.setState({
      filteredImages,
      filterOptions,
      filteredImagesByFilter: this.getFilteredImagesByFilter(
        filteredImages,
        filterOptions
      ),
      filteredImagesBySearch: filteredImages,
    });
  }

  getFilterOptions(images: Images): FilterOptions {
    return {
      [t('Status')]: [...new Set(images.map(image => image.status))].map(status => ({
        id: status,
        symbol: <Status status={status} />,
        isChecked: status !== ImageStatus.UNUSED,
      })),
    };
  }

  getFilteredImagesByFilter(filteredImages: Images, filterOptions: FilterOptions) {
    const checkedOptions = new Set(
      Object.values(filterOptions)[0]
        .filter(filterOption => filterOption.isChecked)
        .map(option => option.id)
    );

    if (![...checkedOptions].length) {
      return filteredImages;
    }
    return filteredImages.filter(image => checkedOptions.has(image.status));
  }

  handleChangeFilter = (filterOptions: FilterOptions) => {
    const {filteredImagesBySearch} = this.state;
    const filteredImagesByFilter = this.getFilteredImagesByFilter(
      filteredImagesBySearch,
      filterOptions
    );

    this.setState({filterOptions, filteredImagesByFilter}, this.updateGrid);
  };

  handleChangeSearchTerm = (searchTerm = '') => {
    DebugMetaActions.updateFilter(searchTerm);
  };

  handleResetFilter = () => {
    const {filterOptions} = this.state;
    this.setState(
      {
        filterOptions: Object.keys(filterOptions).reduce((accumulator, currentValue) => {
          accumulator[currentValue] = filterOptions[currentValue].map(filterOption => ({
            ...filterOption,
            isChecked: false,
          }));
          return accumulator;
        }, {}),
      },
      this.filterImagesBySearchTerm
    );
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
            height={this.getListHeight()}
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
    const {searchTerm, filteredImagesByFilter: images, filterOptions} = this.state;

    if (!!images.length) {
      return {};
    }

    if (searchTerm && !images.length) {
      const hasActiveFilter = Object.values(filterOptions)
        .flatMap(filterOption => filterOption)
        .find(filterOption => filterOption.isChecked);

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
      filteredImagesByFilter: filteredImages,
    } = this.state;
    const {data} = this.props;
    const {images} = data;

    if (shouldSkipSection(filteredImages, images)) {
      return null;
    }

    const displayFilter = (Object.values(filterOptions ?? {})[0] ?? []).length > 1;

    return (
      <StyledEventDataSection
        type="images-loaded"
        title={
          <TitleWrapper>
            <GuideAnchor target="images-loaded" position="bottom">
              <Title>{t('Images Loaded')}</Title>
            </GuideAnchor>
            <QuestionTooltip
              size="xs"
              position="top"
              title={t(
                'A list of dynamic librarys or shared objects loaded into process memory at the time of the crash. Images contribute application code that is referenced in stack traces.'
              )}
            />
          </TitleWrapper>
        }
        actions={
          <Search>
            {displayFilter && (
              <Filter options={filterOptions} onFilter={this.handleChangeFilter} />
            )}
            <StyledSearchBar
              query={searchTerm}
              onChange={value => this.handleChangeSearchTerm(value)}
              placeholder={t('Search images')}
              blendWithFilter={displayFilter}
            />
          </Search>
        }
        wrapTitle={false}
        isCentered
      >
        <StyledPanelTable
          isEmpty={!filteredImages.length}
          scrollbarWidth={scrollbarWidth}
          headers={[t('Status'), t('Image'), t('Processing'), t('Details'), '']}
          {...this.getEmptyMessage()}
        >
          <div ref={this.panelTableRef}>{this.renderList()}</div>
        </StyledPanelTable>
      </StyledEventDataSection>
    );
  }
}

export default withRouter(DebugMeta);

const StyledEventDataSection = styled(EventDataSection)`
  padding-bottom: ${space(4)};

  /* to increase specificity */
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    padding-bottom: ${space(2)};
  }
`;

const StyledPanelTable = styled(PanelTable)<{scrollbarWidth?: number}>`
  overflow: hidden;
  > * {
    :nth-child(-n + 5) {
      ${overflowEllipsis};
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

const TitleWrapper = styled('div')`
  display: grid;
  grid-template-columns: max-content 1fr;
  grid-gap: ${space(0.5)};
  align-items: center;
  padding: ${space(0.75)} 0;
`;

const Title = styled('h3')`
  margin-bottom: 0;
  padding: 0 !important;
  height: 14px;
`;

const StyledList = styled(List)<{height: number}>`
  height: auto !important;
  max-height: ${p => p.height}px;
  overflow-y: auto !important;
  outline: none;
`;

const Search = styled('div')`
  display: grid;
  grid-gap: ${space(2)};
  width: 100%;
  margin-top: ${space(1)};

  @media (min-width: ${props => props.theme.breakpoints[0]}) {
    margin-top: 0;
    grid-gap: 0;
    grid-template-columns: ${p =>
      p.children && React.Children.toArray(p.children).length === 1
        ? '1fr'
        : 'max-content 1fr'};
    justify-content: flex-end;
  }

  @media (min-width: ${props => props.theme.breakpoints[1]}) {
    width: 400px;
  }

  @media (min-width: ${props => props.theme.breakpoints[3]}) {
    width: 600px;
  }
`;

// TODO(matej): remove this once we refactor SearchBar to not use css classes
// - it could accept size as a prop
const StyledSearchBar = styled(SearchBar)<{blendWithFilter?: boolean}>`
  width: 100%;
  position: relative;
  .search-input {
    height: 32px;
  }
  .search-clear-form,
  .search-input-icon {
    height: 32px;
    display: flex;
    align-items: center;
  }

  @media (min-width: ${props => props.theme.breakpoints[0]}) {
    ${p =>
      p.blendWithFilter &&
      `
        .search-input,
        .search-input:focus {
          border-top-left-radius: 0;
          border-bottom-left-radius: 0;
        }
      `}
  }
`;
