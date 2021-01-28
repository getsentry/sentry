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

import {openModal} from 'app/actionCreators/modal';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import Button from 'app/components/button';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import EventDataSection from 'app/components/events/eventDataSection';
import {getImageRange, parseAddress} from 'app/components/events/interfaces/utils';
import {PanelTable} from 'app/components/panels';
import QuestionTooltip from 'app/components/questionTooltip';
import SearchBar from 'app/components/searchBar';
import {IconSearch} from 'app/icons/iconSearch';
import {t} from 'app/locale';
import DebugMetaStore, {DebugMetaActions} from 'app/stores/debugMetaStore';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {Image, ImageStatus} from 'app/types/debugImage';
import {Event} from 'app/types/event';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

import Status from './debugImage/status';
import DebugImage from './debugImage';
import DebugImageDetails, {modalCss} from './debugImageDetails';
import Filter from './filter';
import layout from './layout';
import {combineStatus, getFileName, normalizeId} from './utils';

export const PANEL_MAX_HEIGHT = 400;

type DefaultProps = {
  data: {
    images: Array<Image>;
  };
};

type FilterOptions = React.ComponentProps<typeof Filter>['options'];
type Images = Array<React.ComponentProps<typeof DebugImage>['image']>;

type Props = DefaultProps &
  WithRouterProps & {
    event: Event;
    organization: Organization;
    projectId: Project['id'];
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
    filterOptions: [],
    filteredImages: [],
    filteredImagesByFilter: [],
    filteredImagesBySearch: [],
  };

  componentDidMount() {
    this.unsubscribeFromStore = DebugMetaStore.listen(this.onStoreChange, undefined);
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
    if (this.unsubscribeFromStore) {
      this.unsubscribeFromStore();
    }
  }

  unsubscribeFromStore: any;

  panelTableRef = React.createRef<HTMLDivElement>();
  listRef: List | null = null;

  onStoreChange = (store: {filter: string}) => {
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

  isValidImage(image: Image) {
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

  openImageDetailsModal() {
    const {location, organization, projectId, data} = this.props;
    const {query} = location;
    const {imageId} = query;

    if (!imageId) {
      return;
    }

    const {images} = data;
    const image = images.find(({code_id}) => code_id === imageId);

    if (!image) {
      return;
    }

    openModal(
      modalProps => (
        <DebugImageDetails
          {...modalProps}
          image={image}
          organization={organization}
          projectId={projectId}
        />
      ),
      {
        modalCss,
        onClose: this.handleCloseImageDetailsModal,
      }
    );
  }

  getPanelBodyHeight() {
    const panelTableHeight = this.panelTableRef?.current?.offsetHeight;

    if (!panelTableHeight) {
      return;
    }

    this.setState({panelTableHeight});
  }

  getListHeight() {
    const {panelTableHeight} = this.state;

    if (!panelTableHeight || panelTableHeight > PANEL_MAX_HEIGHT) {
      return PANEL_MAX_HEIGHT;
    }

    return panelTableHeight;
  }

  getRelevantImages() {
    const {data} = this.props;
    const {images} = data;

    // There are a bunch of images in debug_meta that are not relevant to this
    // component. Filter those out to reduce the noise. Most importantly, this
    // includes proguard images, which are rendered separately.
    const relevantImages = images.filter(this.isValidImage).map(releventImage => {
      const {debug_status, unwind_status} = releventImage;
      return {
        ...releventImage,
        status: combineStatus(debug_status, unwind_status),
      };
    });

    // Sort images by their start address. We assume that images have
    // non-overlapping ranges. Each address is given as hex string (e.g.
    // "0xbeef").
    relevantImages.sort(
      (a, b) => parseAddress(a.image_addr) - parseAddress(b.image_addr)
    );

    const unusedImages: Images = [];

    const usedImages = relevantImages.filter(image => {
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
      filteredImagesByFilter: filteredImages,
      filteredImagesBySearch: filteredImages,
    });
  }

  getFilterOptions(images: Images): FilterOptions {
    return [...new Set(images.map(image => image.status))].map(status => ({
      id: status,
      symbol: <Status status={status} />,
      isChecked: false,
    }));
  }

  getFilteredImagesByFilter(filteredImages: Images, filterOptions: FilterOptions) {
    const checkedOptions = new Set(
      filterOptions
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
        filterOptions: filterOptions.map(filterOption => ({
          ...filterOption,
          isChecked: false,
        })),
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

  handleOpenImageDetailsModal = (code_id: Image['code_id']) => {
    const {location, router} = this.props;

    router.push({
      ...location,
      query: {...location.query, imageId: code_id},
    });
  };

  handleCloseImageDetailsModal = () => {
    const {location, router} = this.props;

    router.push({
      ...location,
      query: {...location.query, imageId: undefined},
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
      return images.map(image => (
        <DebugImage
          key={image.debug_file}
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

  renderContent() {
    const {searchTerm, filteredImagesByFilter: images, filterOptions} = this.state;

    if (searchTerm && !images.length) {
      const hasActiveFilter = filterOptions.find(filterOption => filterOption.isChecked);
      return (
        <EmptyMessage
          icon={<IconSearch size="xl" />}
          action={
            hasActiveFilter ? (
              <Button onClick={this.handleResetFilter} priority="primary">
                {t('Reset Filter')}
              </Button>
            ) : (
              <Button onClick={this.handleResetSearchBar} priority="primary">
                {t('Clear Search Bar')}
              </Button>
            )
          }
        >
          {t('Sorry, no images match your search query.')}
        </EmptyMessage>
      );
    }

    if (!images.length) {
      return (
        <EmptyStateWarning>
          <p>{t('There are no images to be displayed')}</p>
        </EmptyStateWarning>
      );
    }

    return <div ref={this.panelTableRef}>{this.renderList()}</div>;
  }

  render() {
    const {
      searchTerm,
      filterOptions,
      filteredImagesByFilter: images,
      scrollbarWidth,
    } = this.state;

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
            <Filter options={filterOptions} onFilter={this.handleChangeFilter} />
            <StyledSearchBar
              query={searchTerm}
              onChange={value => this.handleChangeSearchTerm(value)}
              placeholder={t('Search images\u2026')}
            />
          </Search>
        }
        wrapTitle={false}
        isCentered
      >
        <StyledPanelTable
          scrollbarWidth={scrollbarWidth}
          headers={[t('Status'), t('Image'), t('Processing'), t('Details'), '']}
          isEmpty={!images.length}
          emptyMessage={t('There are no images to display')}
        >
          {this.renderContent()}
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

    ${p =>
      !p.isEmpty &&
      `:nth-child(n + 6) {
    display: grid;
    grid-column: 1/-1;
    padding: 0;
  }`}
  }

  ${p => layout(p.theme, p.scrollbarWidth)}
`;

// Section Title
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

// Virtual List
const StyledList = styled(List)<{height: number}>`
  height: auto !important;
  max-height: ${p => p.height}px;
  overflow-y: auto !important;
  outline: none;
`;

// Search
const Search = styled('div')`
  display: flex;
  width: 100%;
  margin-top: ${space(1)};
  @media (min-width: ${props => props.theme.breakpoints[1]}) {
    width: 400px;
    margin-top: 0;
  }
  @media (min-width: ${props => props.theme.breakpoints[3]}) {
    width: 600px;
  }
`;

// TODO(matej): remove this once we refactor SearchBar to not use css classes
// - it could accept size as a prop
const StyledSearchBar = styled(SearchBar)`
  width: 100%;
  position: relative;
  z-index: ${p => p.theme.zIndex.dropdownAutocomplete.actor};
  .search-input {
    height: 32px;
  }
  .search-input,
  .search-input:focus {
    border-top-left-radius: 0;
    border-bottom-left-radius: 0;
  }
  .search-clear-form,
  .search-input-icon {
    height: 32px;
    display: flex;
    align-items: center;
  }
`;
