import isNil from 'lodash/isNil';
import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import Access from 'app/components/acl/access';
import Button from 'app/components/button';
import DebugFileFeature from 'app/components/debugFileFeature';
import {PanelItem} from 'app/components/panels';
import Tooltip from 'app/components/tooltip';
import {formatAddress, getImageRange} from 'app/components/events/interfaces/utils';
import {t} from 'app/locale';
import {IconSearch, IconCircle, IconCheckmark, IconFlag} from 'app/icons';
import {Organization, Project} from 'app/types';

import {getFileName, combineStatus} from './utils';

type Status = ReturnType<typeof combineStatus>;

const IMAGE_ADDR_LEN = 12;

function getImageStatusText(status: Status) {
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

function getImageStatusDetails(status: Status) {
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

type Props = {
  image: Image;
  showDetails: boolean;
  style?: React.CSSProperties;
  orgId?: Organization['id'];
  projectId?: Project['id'];
};

type DebugStatus = ReturnType<typeof combineStatus>;

type Image = {
  code_id: string;
  code_file: string;
  debug_id: string;
  debug_file: string;
  features: {
    has_sources: boolean;
    has_debug_info: boolean;
    has_unwind_info: boolean;
    has_symbols: boolean;
  };
  image_addr: string;
  image_size: number;
  type: string;
  debug_status?: DebugStatus;
  unwind_status?: DebugStatus;
  image_vmaddr?: string;
  arch?: string;
};

const DebugImage = React.memo(({image, orgId, projectId, showDetails, style}: Props) => {
  const getSettingsLink = () => {
    if (!orgId || !projectId || !image.debug_id) {
      return null;
    }
    return `/settings/${orgId}/projects/${projectId}/debug-symbols/?query=${image.debug_id}`;
  };

  const renderStatus = (title: string, status: DebugStatus) => {
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
  };

  const combinedStatus = combineStatus(image?.debug_status, image.unwind_status);
  const [startAddress, endAddress] = getImageRange(image);

  const renderIconElement = () => {
    switch (combinedStatus) {
      case 'unused':
        return (
          <IconWrapper>
            <IconCircle />
          </IconWrapper>
        );
      case 'found':
        return (
          <IconWrapper>
            <IconCheckmark isCircled color="green300" />
          </IconWrapper>
        );
      default:
        return (
          <IconWrapper>
            <IconFlag color="red300" />
          </IconWrapper>
        );
    }
  };

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
    <DebugImageItem style={style}>
      <ImageInfoGroup>{renderIconElement()}</ImageInfoGroup>

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
            {renderStatus(t('Stack Unwinding'), image.unwind_status)}
            {renderStatus(t('Symbolication'), image.debug_status)}
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
          const settingsUrl = getSettingsLink();
          if (!settingsUrl) {
            return null;
          }
          return (
            <ImageActions>
              <Tooltip title={t('Search for debug files in settings')}>
                <Button size="xsmall" icon={<IconSearch size="xs" />} to={settingsUrl} />
              </Tooltip>
            </ImageActions>
          );
        }}
      </Access>
    </DebugImageItem>
  );
});

export default DebugImage;

const DebugImageItem = styled(PanelItem)`
  font-size: ${p => p.theme.fontSizeSmall};
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: grid;
    grid-gap: ${space(1)};
    position: relative;
  }
`;

const Formatted = styled('span')`
  font-family: ${p => p.theme.text.familyMono};
`;

const ImageInfoGroup = styled('div')<{fullWidth?: boolean}>`
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

const IconWrapper = styled('span')`
  display: inline-block;
  margin-top: ${space(0.5)};
  height: 16px;

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    margin-top: ${space(0.25)};
  }
`;

const SymbolicationStatus = styled('span')`
  flex-grow: 1;
  flex-basis: 0;
  margin-right: 1em;

  svg {
    margin-left: 0.66ex;
  }
`;
