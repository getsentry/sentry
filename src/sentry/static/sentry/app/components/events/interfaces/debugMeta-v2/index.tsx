import React from 'react';
import {
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  List,
  ListRowProps,
} from 'react-virtualized';
import styled from '@emotion/styled';
import isNil from 'lodash/isNil';

import {openModal} from 'app/actionCreators/modal';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import EmptyStateWarning from 'app/components/emptyStateWarning';
import EventDataSection from 'app/components/events/eventDataSection';
import {getImageRange, parseAddress} from 'app/components/events/interfaces/utils';
import {Panel, PanelHeader} from 'app/components/panels';
import QuestionTooltip from 'app/components/questionTooltip';
import SearchBar from 'app/components/searchBar';
import {t} from 'app/locale';
import DebugMetaStore, {DebugMetaActions} from 'app/stores/debugMetaStore';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Organization, Project} from 'app/types';
import {Image} from 'app/types/debugImage';
import {Event} from 'app/types/event';
import {defined} from 'app/utils';

import DebugImage from './debugImage';
import DebugImageDetails, {modalCss} from './debugImageDetails';
import layout from './layout';
import {getFileName, normalizeId} from './utils';

const MIN_FILTER_LEN = 3;
const PANEL_MAX_HEIGHT = 400;

type DefaultProps = {
  data: {
    images: Array<Image>;
  };
};

type Props = DefaultProps & {
  event: Event;
  organization: Organization;
  projectId: Project['id'];
};

type State = {
  filter: string;
  filteredImages: Array<Image>;
  isLoading: boolean;
  panelTableHeight?: number;
  innerListWidth?: number;
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
    filter: '',
    filteredImages: [],
    isLoading: false,
  };

  componentDidMount() {
    this.unsubscribeFromStore = DebugMetaStore.listen(this.onStoreChange, undefined);
    cache.clearAll();
    this.filterImages();
  }

  componentDidUpdate(_prevProps: Props, prevState: State) {
    if (prevState.filter !== this.state.filter) {
      this.filterImages();
    }

    if (prevState.filteredImages.length === 0 && this.state.filteredImages.length > 0) {
      this.getPanelBodyHeight();
    }

    if (this.state.isLoading) {
      this.getInnerListWidth();
    }
  }

  componentWillUnmount() {
    if (this.unsubscribeFromStore) {
      this.unsubscribeFromStore();
    }
  }

  unsubscribeFromStore: any;

  panelTableRef = React.createRef<HTMLDivElement>();
  listRef: List | null = null;

  getInnerListWidth() {
    const innerListWidth = this.panelTableRef?.current?.querySelector(
      '.ReactVirtualized__Grid__innerScrollContainer'
    )?.clientWidth;

    if (innerListWidth !== this.state.innerListWidth) {
      this.setState({innerListWidth, isLoading: false});
      return;
    }

    this.setState({isLoading: false});
  }

  onListResize = () => {
    this.setState({isLoading: true}, this.updateGrid);
  };

  updateGrid = () => {
    if (this.listRef) {
      cache.clearAll();
      this.listRef.forceUpdateGrid();
    }
  };

  getPanelBodyHeight() {
    const panelTableHeight = this.panelTableRef?.current?.offsetHeight;

    if (!panelTableHeight) {
      return;
    }

    this.setState({panelTableHeight});
  }

  onStoreChange = (store: {filter: string}) => {
    this.setState({filter: store.filter});
  };

  filterImage(image: Image) {
    const {filter} = this.state;

    const searchTerm = filter.trim().toLowerCase();

    if (searchTerm.length < MIN_FILTER_LEN) {
      // A debug status of `null` indicates that this information is not yet
      // available in an old event. Default to showing the image.
      if (image.debug_status !== 'unused') {
        return true;
      }

      // An unwind status of `null` indicates that symbolicator did not unwind.
      // Ignore the status in this case.
      if (!isNil(image.unwind_status) && image.unwind_status !== 'unused') {
        return true;
      }

      return false;
    }

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

  getDebugImages() {
    const {data} = this.props;
    const {images} = data;

    // There are a bunch of images in debug_meta that are not relevant to this
    // component. Filter those out to reduce the noise. Most importantly, this
    // includes proguard images, which are rendered separately.
    const filtered = images.filter(image => this.isValidImage(image));

    // Sort images by their start address. We assume that images have
    // non-overlapping ranges. Each address is given as hex string (e.g.
    // "0xbeef").
    filtered.sort((a, b) => parseAddress(a.image_addr) - parseAddress(b.image_addr));

    return filtered;
  }

  filterImages() {
    // skip null values indicating invalid debug images
    const debugImages = this.getDebugImages();
    const filteredImages = debugImages.filter(image => this.filterImage(image));

    this.setState({filteredImages}, this.updateGrid);
  }

  getListHeight() {
    const {panelTableHeight} = this.state;

    if (!panelTableHeight || panelTableHeight > PANEL_MAX_HEIGHT) {
      return PANEL_MAX_HEIGHT;
    }

    return panelTableHeight;
  }

  handleChangeFilter = (value = '') => {
    DebugMetaActions.updateFilter(value);
  };

  handleOpenImageDetailsModal = (
    image: Image,
    imageAddress: React.ReactElement | null,
    fileName?: string
  ) => {
    const {organization, projectId} = this.props;
    return openModal(
      modalProps => (
        <DebugImageDetails
          {...modalProps}
          image={image}
          title={fileName}
          organization={organization}
          projectId={projectId}
          imageAddress={imageAddress}
        />
      ),
      {
        modalCss,
      }
    );
  };

  renderRow = ({index, key, parent, style}: ListRowProps) => {
    const {filteredImages} = this.state;

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
          image={filteredImages[index]}
          onOpenImageDetailsModal={this.handleOpenImageDetailsModal}
        />
      </CellMeasurer>
    );
  };

  renderList() {
    const {filteredImages: images, panelTableHeight} = this.state;

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
      <AutoSizer disableHeight onResize={this.onListResize}>
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

  render() {
    const {filter, filteredImages: images, innerListWidth} = this.state;

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
          <ToolbarWrapper>
            <SearchInputWrapper>
              <StyledSearchBar
                query={filter}
                onChange={this.handleChangeFilter}
                placeholder={t('Search images')}
              />
            </SearchInputWrapper>
          </ToolbarWrapper>
        }
        wrapTitle={false}
        isCentered
      >
        <StyledPanel innerListWidth={innerListWidth}>
          <StyledPanelHeader>
            <div>{t('Status')}</div>
            <div>{t('Image')}</div>
            <div>{t('Processing')}</div>
            <div>{t('Details')}</div>
          </StyledPanelHeader>
          {!images.length ? (
            <EmptyStateWarning>
              <p>{t('There are no images to be displayed')}</p>
            </EmptyStateWarning>
          ) : (
            <div ref={this.panelTableRef}>{this.renderList()}</div>
          )}
        </StyledPanel>
      </StyledEventDataSection>
    );
  }
}

export default DebugMeta;

const StyledEventDataSection = styled(EventDataSection)`
  padding-bottom: ${space(4)};

  /* to increase specificity */
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    padding-bottom: ${space(2)};
  }
`;

const StyledPanelHeader = styled(PanelHeader)`
  padding: 0;
  > * {
    padding: ${space(2)};
    ${overflowEllipsis};
  }
  ${p => layout(p.theme)};
`;

const StyledPanel = styled(Panel)<{innerListWidth?: number}>`
  ${p =>
    p.innerListWidth &&
    `
        ${StyledPanelHeader} {
          padding-right: calc(100% - ${p.innerListWidth}px);
        }
    `};
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

const ToolbarWrapper = styled('div')`
  display: flex;
  align-items: center;
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    flex-wrap: wrap;
    margin-top: ${space(1)};
  }
`;

const SearchInputWrapper = styled('div')`
  width: 100%;

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    width: 100%;
    max-width: 100%;
    margin-top: ${space(1)};
  }

  @media (min-width: ${p => p.theme.breakpoints[0]}) and (max-width: ${p =>
      p.theme.breakpoints[3]}) {
    max-width: 180px;
    display: inline-block;
  }

  @media (min-width: ${props => props.theme.breakpoints[3]}) {
    width: 330px;
    max-width: none;
  }

  @media (min-width: 1550px) {
    width: 510px;
  }
`;

// TODO(matej): remove this once we refactor SearchBar to not use css classes
// - it could accept size as a prop
const StyledSearchBar = styled(SearchBar)`
  .search-input {
    height: 30px;
  }
`;
