import isNil from 'lodash/isNil';
import PropTypes from 'prop-types';
import React from 'react';
import styled from '@emotion/styled';
import isEqual from 'lodash/isEqual';

import space from 'app/styles/space';
import Access from 'app/components/acl/access';
import GuideAnchor from 'app/components/assistant/guideAnchor';
import Button from 'app/components/button';
import Checkbox from 'app/components/checkbox';
import DebugFileFeature from 'app/components/debugFileFeature';
import EventDataSection from 'app/components/events/eventDataSection';
import InlineSvg from 'app/components/inlineSvg';
import {Panel, PanelBody, PanelItem} from 'app/components/panels';
import Tooltip from 'app/components/tooltip';
import DebugMetaStore, {DebugMetaActions} from 'app/stores/debugMetaStore';
import SearchBar from 'app/components/searchBar';
import {
  formatAddress,
  parseAddress,
  getImageRange,
} from 'app/components/events/interfaces/utils';
import ImageForBar from 'app/components/events/interfaces/imageForBar';
import {t, tct} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import {IconSearch} from 'app/icons';
import ClippedBox from 'app/components/clippedBox';

const IMAGE_ADDR_LEN = 12;
const MIN_FILTER_LEN = 3;

function getFileName(path) {
  const directorySeparator = /^([a-z]:\\|\\\\)/i.test(path) ? '\\' : '/';
  return path.split(directorySeparator).pop();
}

function getStatusWeight(status) {
  switch (status) {
    case null:
    case undefined:
    case 'unused':
      return 0;
    case 'found':
      return 1;
    default:
      return 2;
  }
}

function getImageStatusText(status) {
  switch (status) {
    case 'found':
      return t('ok');
    case 'unused':
      return t('unused');
    case 'missing':
      return t('missing');
    case 'malformed':
    case 'fetching_failed':
    case 'timeout':
    case 'other':
      return t('failed');
    default:
      return null;
  }
}

function getImageStatusDetails(status) {
  switch (status) {
    case 'found':
      return t('Debug information for this image was found and successfully processed.');
    case 'unused':
      return t('The image was not required for processing the stack trace.');
    case 'missing':
      return t('No debug information could be found in any of the specified sources.');
    case 'malformed':
      return t('The debug information file for this image failed to process.');
    case 'timeout':
    case 'fetching_failed':
      return t('The debug information file for this image could not be downloaded.');
    case 'other':
      return t('An internal error occurred while handling this image.');
    default:
      return null;
  }
}

export const combineStatus = (debugStatus, unwindStatus) => {
  const debugWeight = getStatusWeight(debugStatus);
  const unwindWeight = getStatusWeight(unwindStatus);

  const combined = debugWeight >= unwindWeight ? debugStatus : unwindStatus;
  return combined || 'unused';
};

class DebugImage extends React.Component {
  static propTypes = {
    image: PropTypes.object.isRequired,
    orgId: PropTypes.string,
    projectId: PropTypes.string,
    showDetails: PropTypes.bool.isRequired,
  };

  shouldComponentUpdate(nextProps) {
    return (
      !isEqual(this.props.image, nextProps.image) ||
      this.props.orgId !== nextProps.orgId ||
      this.props.projectId !== nextProps.projectId ||
      this.props.showDetails !== nextProps.showDetails
    );
  }

  getSettingsLink(image) {
    const {orgId, projectId} = this.props;
    if (!orgId || !projectId || !image.debug_id) {
      return null;
    }

    return `/settings/${orgId}/projects/${projectId}/debug-symbols/?query=${image.debug_id}`;
  }

  renderStatus(title, status) {
    if (isNil(status)) {
      return null;
    }

    const text = getImageStatusText(status);
    if (!text) {
      return null;
    }

    return (
      <SymbolicationStatus>
        <Tooltip title={getImageStatusDetails(status)}>
          <span>
            <ImageProp>{title}</ImageProp>: {text}
          </span>
        </Tooltip>
      </SymbolicationStatus>
    );
  }

  render() {
    const {image, showDetails} = this.props;

    const combinedStatus = combineStatus(image.debug_status, image.unwind_status);
    const [startAddress, endAddress] = getImageRange(image);

    let iconElement = null;
    switch (combinedStatus) {
      case 'unused':
        iconElement = <ImageIcon type="muted" src="icon-circle-empty" />;
        break;
      case 'found':
        iconElement = <ImageIcon type="success" src="icon-circle-check" />;
        break;
      default:
        iconElement = <ImageIcon type="error" src="icon-circle-exclamation" />;
        break;
    }

    const codeFile = getFileName(image.code_file);
    const debugFile = image.debug_file && getFileName(image.debug_file);

    // The debug file is only realistically set on Windows. All other platforms
    // either leave it empty or set it to a filename thats equal to the code
    // file name. In this case, do not show it.
    const showDebugFile = debugFile && codeFile !== debugFile;

    // Availability only makes sense if the image is actually referenced.
    // Otherwise, the processing pipeline does not resolve this kind of
    // information and it will always be false.
    const showAvailability = !isNil(image.features) && combinedStatus !== 'unused';

    // The code id is sometimes missing, and sometimes set to the equivalent of
    // the debug id (e.g. for Mach symbols). In this case, it is redundant
    // information and we do not want to show it.
    const showCodeId = !!image.code_id && image.code_id !== image.debug_id;

    // Old versions of the event pipeline did not store the symbolication
    // status. In this case, default to display the debug_id instead of stack
    // unwind information.
    const legacyRender = isNil(image.debug_status);

    const debugIdElement = (
      <ImageSubtext>
        <ImageProp>{t('Debug ID')}</ImageProp>: <Formatted>{image.debug_id}</Formatted>
      </ImageSubtext>
    );

    return (
      <DebugImageItem>
        <ImageInfoGroup>{iconElement}</ImageInfoGroup>

        <ImageInfoGroup>
          <Formatted>{formatAddress(startAddress, IMAGE_ADDR_LEN)}</Formatted> &ndash;{' '}
          <AddressDivider />
          <Formatted>{formatAddress(endAddress, IMAGE_ADDR_LEN)}</Formatted>
        </ImageInfoGroup>

        <ImageInfoGroup fullWidth>
          <ImageTitle>
            <Tooltip title={image.code_file}>
              <CodeFile>{codeFile}</CodeFile>
            </Tooltip>
            {showDebugFile && <DebugFile> ({debugFile})</DebugFile>}
          </ImageTitle>

          {legacyRender ? (
            debugIdElement
          ) : (
            <StatusLine>
              {this.renderStatus(t('Stack Unwinding'), image.unwind_status)}
              {this.renderStatus(t('Symbolication'), image.debug_status)}
            </StatusLine>
          )}

          {showDetails && (
            <React.Fragment>
              {showAvailability && (
                <ImageSubtext>
                  <ImageProp>{t('Availability')}</ImageProp>:
                  <DebugFileFeature
                    feature="symtab"
                    available={image.features.has_symbols}
                  />
                  <DebugFileFeature
                    feature="debug"
                    available={image.features.has_debug_info}
                  />
                  <DebugFileFeature
                    feature="unwind"
                    available={image.features.has_unwind_info}
                  />
                  <DebugFileFeature
                    feature="sources"
                    available={image.features.has_sources}
                  />
                </ImageSubtext>
              )}

              {!legacyRender && debugIdElement}

              {showCodeId && (
                <ImageSubtext>
                  <ImageProp>{t('Code ID')}</ImageProp>:{' '}
                  <Formatted>{image.code_id}</Formatted>
                </ImageSubtext>
              )}

              {!!image.arch && (
                <ImageSubtext>
                  <ImageProp>{t('Architecture')}</ImageProp>: {image.arch}
                </ImageSubtext>
              )}
            </React.Fragment>
          )}
        </ImageInfoGroup>

        <Access access={['project:releases']}>
          {({hasAccess}) => {
            if (!hasAccess) {
              return null;
            }

            const settingsUrl = this.getSettingsLink(image);
            if (!settingsUrl) {
              return null;
            }

            return (
              <ImageActions>
                <Tooltip title={t('Search for debug files in settings')}>
                  <Button
                    size="xsmall"
                    icon={<IconSearch size="xs" />}
                    to={settingsUrl}
                  />
                </Tooltip>
              </ImageActions>
            );
          }}
        </Access>
      </DebugImageItem>
    );
  }
}

class DebugMetaInterface extends React.PureComponent {
  static propTypes = {
    event: SentryTypes.Event.isRequired,
    data: PropTypes.object.isRequired,
    orgId: PropTypes.string,
    projectId: PropTypes.string,
  };

  constructor(props) {
    super(props);

    this.state = {
      filter: null,
      showUnused: false,
      showDetails: false,
    };
  }

  componentDidMount() {
    this.unsubscribeFromStore = DebugMetaStore.listen(this.onStoreChange);
  }
  componentWillUnmount() {
    this.unsubscribeFromStore();
  }
  onStoreChange = store => {
    this.setState({
      filter: store.filter,
    });
  };

  filterImage(image) {
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

  handleChangeShowUnused = e => {
    const showUnused = e.target.checked;
    this.setState({showUnused});
  };

  handleShowUnused = () => {
    this.setState({showUnused: true});
  };

  handleChangeShowDetails = e => {
    const showDetails = e.target.checked;
    this.setState({showDetails});
  };

  handleChangeFilter = value => {
    DebugMetaActions.updateFilter(value || '');
  };

  isValidImage(image) {
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
    const images = this.props.data.images || [];

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

  getNoImagesMessage(images) {
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
            query={filter}
            onChange={this.handleChangeFilter}
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

    const titleElement = (
      <GuideAnchor target="packages" position="bottom">
        <h3>{t('Images Loaded')}</h3>
      </GuideAnchor>
    );

    const frames = this.props.event.entries.find(({type}) => type === 'exception')?.data
      ?.values?.[0]?.stacktrace?.frames;
    const foundFrame = frames
      ? frames.find(frame => frame.instructionAddr === this.state.filter)
      : null;

    return (
      <StyledEventDataSection
        event={this.props.event}
        type="packages"
        title={titleElement}
        actions={this.renderToolbar()}
        wrapTitle={false}
        isCentered
      >
        <DebugImagesPanel>
          <ClippedBox clipHeight={560}>
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
                <EmptyItem>
                  <ImageIcon type="muted" src="icon-circle-exclamation" />{' '}
                  {this.getNoImagesMessage(images)}
                </EmptyItem>
              )}
            </PanelBody>
          </ClippedBox>
        </DebugImagesPanel>
      </StyledEventDataSection>
    );
  }
}

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

const DebugImageItem = styled(PanelItem)`
  font-size: ${p => p.theme.fontSizeSmall};
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: grid;
    grid-gap: ${space(1)};
    position: relative;
  }
`;

const ImageIcon = styled(InlineSvg)`
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.alert[p.type].iconColor};
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    font-size: ${p => p.theme.fontSizeExtraLarge};
    margin-bottom: ${space(0.5)};
  }
`;

const Formatted = styled('span')`
  font-family: ${p => p.theme.text.familyMono};
`;

const ImageInfoGroup = styled('div')`
  margin-left: 1em;
  flex-grow: ${p => (p.fullWidth ? 1 : null)};

  &:first-child {
    @media (min-width: ${p => p.theme.breakpoints[0]}) {
      margin-left: 0;
    }
  }
`;

const ImageActions = styled(ImageInfoGroup)`
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    position: absolute;
    top: 15px;
    right: 20px;
  }
`;

const ImageTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
`;

const CodeFile = styled('span')`
  font-weight: bold;
`;

const DebugFile = styled('span')`
  color: ${p => p.theme.gray500};
`;

const ImageSubtext = styled('div')`
  color: ${p => p.theme.gray500};
`;

const ImageProp = styled('span')`
  font-weight: bold;
`;

const StatusLine = styled(ImageSubtext)`
  display: flex;
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: grid;
  }
`;

const AddressDivider = styled('br')`
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: none;
  }
`;

const SymbolicationStatus = styled('span')`
  flex-grow: 1;
  flex-basis: 0;
  margin-right: 1em;

  ${ImageIcon} {
    margin-left: 0.66ex;
  }
`;

const EmptyItem = styled(PanelItem)`
  display: flex;
  align-items: center;
  justify-content: center;

  ${ImageIcon} {
    opacity: 0.4;
    margin-right: 1ex;
    vertical-align: text-bottom;
  }
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
  .icon-search {
    top: 8px;
  }
`;

export default DebugMetaInterface;
