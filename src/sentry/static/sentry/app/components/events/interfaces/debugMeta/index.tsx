import isNil from 'lodash/isNil';
import React from 'react';
import styled from '@emotion/styled';

import EmptyMessage from 'app/views/settings/components/emptyMessage';
import space from 'app/styles/space';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import Button from 'app/components/button';
import Checkbox from 'app/components/checkbox';
import EventDataSection from 'app/components/events/eventDataSection';
import {Panel, PanelBody} from 'app/components/panels';
import DebugMetaStore, {DebugMetaActions} from 'app/stores/debugMetaStore';
import SearchBar from 'app/components/searchBar';
import {parseAddress, getImageRange} from 'app/components/events/interfaces/utils';
import ImageForBar from 'app/components/events/interfaces/imageForBar';
import {t, tct} from 'app/locale';
import ClippedBox from 'app/components/clippedBox';
import {IconWarning} from 'app/icons';
import {Organization, Project, Event, Frame} from 'app/types';

import DebugImage from './debugImage';
import {getFileName} from './utils';

const MIN_FILTER_LEN = 3;
const DEFAULT_CLIP_HEIGHT = 560;

type Image = React.ComponentProps<typeof DebugImage>['image'];

type DefaultProps = {
  data: {
    images: Array<Image>;
  };
};

type Props = DefaultProps & {
  event: Event;
  orgId: Organization['id'];
  projectId: Project['id'];
};

type State = {
  showUnused: boolean;
  showDetails: boolean;
  filter: string;
};

class DebugMeta extends React.PureComponent<Props, State> {
  state: State = {
    showUnused: false,
    showDetails: false,
    filter: '',
  };

  componentDidMount() {
    this.unsubscribeFromStore = DebugMetaStore.listen(this.onStoreChange);
  }
  componentWillUnmount() {
    this.unsubscribeFromStore();
  }

  unsubscribeFromStore: any;

  onStoreChange = (store: {filter: string}) => {
    this.setState({
      filter: store.filter,
    });
  };

  filterImage(image: Image) {
    const {showUnused, filter} = this.state;

    if (!filter || filter.length < MIN_FILTER_LEN) {
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
    // instead of an exact match.
    if (filter.indexOf('0x') === 0) {
      const needle = parseAddress(filter);
      if (needle > 0) {
        const [startAddress, endAddress] = getImageRange(image);
        return needle >= startAddress && needle < endAddress;
      }
    }

    return (
      // Prefix match for identifiers
      (image.code_id || '').indexOf(filter) === 0 ||
      (image.debug_id || '').indexOf(filter) === 0 ||
      // Any match for file paths
      (image.code_file || '').indexOf(filter) >= 0 ||
      (image.debug_file || '').indexOf(filter) >= 0
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

  getNoImagesMessage(images: Array<Image>) {
    const {filter, showUnused} = this.state;

    if (images.length === 0) {
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
            onSearch={this.handleChangeFilter}
            placeholder={t('Search images\u2026')}
          />
        </SearchInputWrapper>
      </ToolbarWrapper>
    );
  }

  render() {
    // skip null values indicating invalid debug images
    const images = this.getDebugImages();

    const filteredImages = images.filter(image => this.filterImage(image));

    const frames: Array<Frame> | undefined = this.props.event.entries.find(
      ({type}) => type === 'exception'
    )?.data?.values?.[0]?.stacktrace?.frames;

    const foundFrame = frames
      ? frames.find(frame => frame.instructionAddr === this.state.filter)
      : undefined;

    return (
      <StyledEventDataSection
        type="packages"
        title={
          <GuideAnchor target="packages" position="bottom">
            <h3>{t('Images Loaded')}</h3>
          </GuideAnchor>
        }
        actions={this.renderToolbar()}
        wrapTitle={false}
        isCentered
      >
        <DebugImagesPanel>
          <ClippedBox clipHeight={DEFAULT_CLIP_HEIGHT}>
            <PanelBody>
              {foundFrame && (
                <ImageForBar
                  frame={foundFrame}
                  onShowAllImages={this.handleChangeFilter}
                />
              )}
              {filteredImages.length > 0 ? (
                filteredImages.map(image => (
                  <DebugImage
                    key={image.debug_id}
                    image={image}
                    orgId={this.props.orgId}
                    projectId={this.props.projectId}
                    showDetails={this.state.showDetails}
                  />
                ))
              ) : (
                <EmptyMessage icon={<IconWarning size="xl" />}>
                  {this.getNoImagesMessage(images)}
                </EmptyMessage>
              )}
            </PanelBody>
          </ClippedBox>
        </DebugImagesPanel>
      </StyledEventDataSection>
    );
  }
}

export default DebugMeta;

const Label = styled('label')`
  font-weight: normal;
  margin-right: 1em;
  margin-bottom: 0;

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
  max-height: 600px;
  overflow-y: auto;
  overflow-x: hidden;
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
  max-width: 180px;
  display: inline-block;
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    width: 100%;
    max-width: 100%;
    margin-top: ${space(1)};
  }
`;
// TODO(matej): remove this once we refactor SearchBar to not use css classes
// - it could accept size as a prop
const StyledSearchBar = styled(SearchBar)`
  .search-input {
    height: 30px;
  }
  .search-clear-form {
    top: 5px !important;
  }
  .search-input-icon {
    top: 8px;
  }
`;
