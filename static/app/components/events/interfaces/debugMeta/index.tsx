import React from 'react';
import {
  AutoSizer,
  CellMeasurer,
  CellMeasurerCache,
  List,
  ListRowProps,
} from 'react-virtualized';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';
import isNil from 'lodash/isNil';

import GuideAnchor from 'app/components/assistant/guideAnchor';
import Button from 'app/components/button';
import Checkbox from 'app/components/checkbox';
import EventDataSection from 'app/components/events/eventDataSection';
import ImageForBar from 'app/components/events/interfaces/imageForBar';
import {getImageRange, parseAddress} from 'app/components/events/interfaces/utils';
import {Panel, PanelBody} from 'app/components/panels';
import SearchBar from 'app/components/searchBar';
import {IconWarning} from 'app/icons';
import {t, tct} from 'app/locale';
import DebugMetaStore, {DebugMetaActions} from 'app/stores/debugMetaStore';
import space from 'app/styles/space';
import {Frame, Organization, Project} from 'app/types';
import {Event} from 'app/types/event';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

import {shouldSkipSection} from '../debugMeta-v2/utils';

import DebugImage from './debugImage';
import {getFileName} from './utils';

const MIN_FILTER_LEN = 3;
const PANEL_MAX_HEIGHT = 400;

type Image = React.ComponentProps<typeof DebugImage>['image'];

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
  debugImages: Array<Image>;
  filteredImages: Array<Image>;
  showUnused: boolean;
  showDetails: boolean;
  foundFrame?: Frame;
  panelBodyHeight?: number;
};

function normalizeId(id: string | undefined): string {
  return id ? id.trim().toLowerCase().replace(/[- ]/g, '') : '';
}

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
    debugImages: [],
    filteredImages: [],
    showUnused: false,
    showDetails: false,
  };

  componentDidMount() {
    this.unsubscribeFromStore = DebugMetaStore.listen(this.onStoreChange, undefined);
    cache.clearAll();
    this.filterImages();
  }

  componentDidUpdate(_prevProps: Props, prevState: State) {
    if (
      prevState.showUnused !== this.state.showUnused ||
      prevState.filter !== this.state.filter
    ) {
      this.filterImages();
    }

    if (
      !isEqual(prevState.foundFrame, this.state.foundFrame) ||
      this.state.showDetails !== prevState.showDetails ||
      prevState.showUnused !== this.state.showUnused ||
      (prevState.filter && !this.state.filter)
    ) {
      this.updateGrid();
    }

    if (prevState.filteredImages.length === 0 && this.state.filteredImages.length > 0) {
      this.getPanelBodyHeight();
    }
  }

  componentWillUnmount() {
    if (this.unsubscribeFromStore) {
      this.unsubscribeFromStore();
    }
  }

  unsubscribeFromStore: any;

  panelBodyRef = React.createRef<HTMLDivElement>();
  listRef: List | null = null;

  updateGrid() {
    cache.clearAll();
    this.listRef?.forceUpdateGrid();
  }

  getPanelBodyHeight() {
    const panelBodyHeight = this.panelBodyRef?.current?.offsetHeight;

    if (!panelBodyHeight) {
      return;
    }

    this.setState({panelBodyHeight});
  }

  onStoreChange = (store: {filter: string}) => {
    this.setState({
      filter: store.filter,
    });
  };

  filterImage(image: Image) {
    const {showUnused, filter} = this.state;

    const searchTerm = filter.trim().toLowerCase();

    if (searchTerm.length < MIN_FILTER_LEN) {
      if (showUnused) {
        return true;
      }

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
        const [startAddress, endAddress] = getImageRange(image);
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

  filterImages() {
    const foundFrame = this.getFrame();
    // skip null values indicating invalid debug images
    const debugImages = this.getDebugImages();

    if (!debugImages.length) {
      return;
    }

    const filteredImages = debugImages.filter(image => this.filterImage(image));

    this.setState({debugImages, filteredImages, foundFrame});
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

  getFrame(): Frame | undefined {
    const {
      event: {entries},
    } = this.props;

    const frames: Array<Frame> | undefined = entries.find(
      ({type}) => type === 'exception'
    )?.data?.values?.[0]?.stacktrace?.frames;

    if (!frames) {
      return undefined;
    }

    const searchTerm = normalizeId(this.state.filter);
    const relMatch = searchTerm.match(/^\s*(.*?)!(.*)$/); // debug_id!address

    if (relMatch) {
      const debugImages = this.getDebugImages().map(
        (image, idx) => [idx, image] as [number, Image]
      );
      const filteredImages = debugImages.filter(([_, image]) => this.filterImage(image));
      if (filteredImages.length === 1) {
        return frames.find(
          frame =>
            frame.addrMode === `rel:${filteredImages[0][0]}` &&
            frame.instructionAddr?.toLowerCase() === relMatch[2]
        );
      }

      return undefined;
    }

    return frames.find(frame => frame.instructionAddr?.toLowerCase() === searchTerm);
  }

  getDebugImages() {
    const {
      data: {images},
    } = this.props;

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

  getNoImagesMessage() {
    const {filter, showUnused, debugImages} = this.state;

    if (debugImages.length === 0) {
      return t('No loaded images available.');
    }

    if (!showUnused && !filter) {
      return tct(
        'No images are referenced in the stack trace. [toggle: Show Unreferenced]',
        {
          toggle: <Button priority="link" onClick={this.handleShowUnused} />,
        }
      );
    }

    return t('Sorry, no images match your query.');
  }

  renderToolbar() {
    const {filter, showDetails, showUnused} = this.state;
    return (
      <ToolbarWrapper>
        <Label>
          <Checkbox checked={showDetails} onChange={this.handleChangeShowDetails} />
          {t('details')}
        </Label>

        <Label>
          <Checkbox
            checked={showUnused || !!filter}
            disabled={!!filter}
            onChange={this.handleChangeShowUnused}
          />
          {t('show unreferenced')}
        </Label>
        <SearchInputWrapper>
          <StyledSearchBar
            onChange={this.handleChangeFilter}
            query={filter}
            placeholder={t('Search images\u2026')}
          />
        </SearchInputWrapper>
      </ToolbarWrapper>
    );
  }

  renderRow = ({index, key, parent, style}: ListRowProps) => {
    const {organization, projectId} = this.props;
    const {filteredImages, showDetails} = this.state;

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
          organization={organization}
          projectId={projectId}
          showDetails={showDetails}
        />
      </CellMeasurer>
    );
  };

  getListHeight() {
    const {showUnused, showDetails, panelBodyHeight} = this.state;

    if (
      !panelBodyHeight ||
      panelBodyHeight > PANEL_MAX_HEIGHT ||
      showUnused ||
      showDetails
    ) {
      return PANEL_MAX_HEIGHT;
    }

    return panelBodyHeight;
  }

  renderImageList() {
    const {filteredImages, showDetails, panelBodyHeight} = this.state;
    const {organization, projectId} = this.props;

    if (!panelBodyHeight) {
      return filteredImages.map(filteredImage => (
        <DebugImage
          key={filteredImage.debug_id}
          image={filteredImage}
          organization={organization}
          projectId={projectId}
          showDetails={showDetails}
        />
      ));
    }

    return (
      <AutoSizer disableHeight>
        {({width}) => (
          <StyledList
            ref={(el: List | null) => {
              this.listRef = el;
            }}
            deferredMeasurementCache={cache}
            height={this.getListHeight()}
            overscanRowCount={5}
            rowCount={filteredImages.length}
            rowHeight={cache.rowHeight}
            rowRenderer={this.renderRow}
            width={width}
            isScrolling={false}
          />
        )}
      </AutoSizer>
    );
  }

  handleChangeShowUnused = (event: React.ChangeEvent<HTMLInputElement>) => {
    const showUnused = event.target.checked;
    this.setState({showUnused});
  };

  handleShowUnused = () => {
    this.setState({showUnused: true});
  };

  handleChangeShowDetails = (event: React.ChangeEvent<HTMLInputElement>) => {
    const showDetails = event.target.checked;
    this.setState({showDetails});
  };

  handleChangeFilter = (value = '') => {
    DebugMetaActions.updateFilter(value);
  };

  render() {
    const {filteredImages, foundFrame} = this.state;
    const {data} = this.props;
    const {images} = data;

    if (shouldSkipSection(filteredImages, images)) {
      return null;
    }

    return (
      <StyledEventDataSection
        type="images-loaded"
        title={
          <GuideAnchor target="images-loaded" position="bottom">
            <h3>{t('Images Loaded')}</h3>
          </GuideAnchor>
        }
        actions={this.renderToolbar()}
        wrapTitle={false}
        isCentered
      >
        <DebugImagesPanel>
          {filteredImages.length > 0 ? (
            <React.Fragment>
              {foundFrame && (
                <ImageForBar
                  frame={foundFrame}
                  onShowAllImages={this.handleChangeFilter}
                />
              )}
              <PanelBody forwardRef={this.panelBodyRef}>
                {this.renderImageList()}
              </PanelBody>
            </React.Fragment>
          ) : (
            <EmptyMessage icon={<IconWarning size="xl" />}>
              {this.getNoImagesMessage()}
            </EmptyMessage>
          )}
        </DebugImagesPanel>
      </StyledEventDataSection>
    );
  }
}

export default DebugMeta;

const StyledList = styled(List)<{height: number}>`
  height: auto !important;
  max-height: ${p => p.height}px;
  outline: none;
`;

const Label = styled('label')`
  font-weight: normal;
  margin-right: 1em;
  margin-bottom: 0;
  white-space: nowrap;

  > input {
    margin-right: 1ex;
  }
`;

const StyledEventDataSection = styled(EventDataSection)`
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    padding-bottom: ${space(4)};
  }
  /* to increase specificity */
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    padding-bottom: ${space(2)};
  }
`;

const DebugImagesPanel = styled(Panel)`
  margin-bottom: ${space(1)};
  max-height: ${PANEL_MAX_HEIGHT}px;
  overflow: hidden;
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
