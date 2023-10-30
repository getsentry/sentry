import {useContext} from 'react';
import styled from '@emotion/styled';
import scrollToElement from 'scroll-to-element';

import {TraceEventDataSectionContext} from 'sentry/components/events/traceEventDataSection';
import {t} from 'sentry/locale';
import DebugMetaStore from 'sentry/stores/debugMetaStore';
import {space} from 'sentry/styles/space';
import {Frame} from 'sentry/types';

import DebugImage from '../../debugMeta/debugImage';
import {combineStatus} from '../../debugMeta/utils';
import {SymbolicatorStatus} from '../../types';
import PackageLink from '../packageLink';
import PackageStatus from '../packageStatus';
import Symbol from '../symbol';
import TogglableAddress from '../togglableAddress';
import {getPlatform} from '../utils';

import Expander from './expander';
import LeadHint from './leadHint';
import Wrapper from './wrapper';

type Props = React.ComponentProps<typeof Expander> &
  React.ComponentProps<typeof LeadHint> & {
    frame: Frame;
    isUsedForGrouping: boolean;
    image?: React.ComponentProps<typeof DebugImage>['image'];
    includeSystemFrames?: boolean;
    isFrameAfterLastNonApp?: boolean;
    maxLengthOfRelativeAddress?: number;
    onClick?: () => void;
    onMouseDown?: React.MouseEventHandler<HTMLDivElement>;
    prevFrame?: Frame;
  };

export function Native({
  frame,
  isFrameAfterLastNonApp,
  isExpanded,
  isHoverPreviewed,
  image,
  includeSystemFrames,
  maxLengthOfRelativeAddress,
  platform,
  prevFrame,
  isUsedForGrouping,
  nextFrame,
  leadsToApp,
  onMouseDown,
  onClick,
  event,
  ...props
}: Props) {
  const traceEventDataSectionContext = useContext(TraceEventDataSectionContext);

  if (!traceEventDataSectionContext) {
    return null;
  }

  const {instructionAddr, trust, addrMode, symbolicatorStatus} = frame ?? {};

  function packageStatus() {
    // this is the status of image that belongs to this frame
    if (!image) {
      return 'empty';
    }

    const combinedStatus = combineStatus(image.debug_status, image.unwind_status);

    switch (combinedStatus) {
      case 'unused':
        return 'empty';
      case 'found':
        return 'success';
      default:
        return 'error';
    }
  }

  function makeFilter(addr: string): string {
    if (!(!addrMode || addrMode === 'abs') && image) {
      return `${image.debug_id}!${addr}`;
    }

    return addr;
  }

  function scrollToImage(e: React.MouseEvent<HTMLAnchorElement>) {
    e.stopPropagation(); // to prevent collapsing if collapsible

    if (instructionAddr) {
      DebugMetaStore.updateFilter(makeFilter(instructionAddr));
    }
    scrollToElement('#images-loaded');
  }

  const shouldShowLinkToImage =
    !!symbolicatorStatus &&
    symbolicatorStatus !== SymbolicatorStatus.UNKNOWN_IMAGE &&
    !isHoverPreviewed;

  const isInlineFrame =
    prevFrame &&
    getPlatform(frame.platform, platform ?? 'other') ===
      (prevFrame.platform || platform) &&
    instructionAddr === prevFrame.instructionAddr;

  const isFoundByStackScanning = trust === 'scan' || trust === 'cfi-scan';

  return (
    <Wrapper className="title as-table" onMouseDown={onMouseDown} onClick={onClick}>
      <NativeLineContent isFrameAfterLastNonApp={!!isFrameAfterLastNonApp}>
        <PackageInfo>
          <LeadHint
            event={event}
            isExpanded={isExpanded}
            nextFrame={nextFrame}
            leadsToApp={leadsToApp}
          />
          <PackageLink
            includeSystemFrames={!!includeSystemFrames}
            withLeadHint={!(isExpanded || !leadsToApp)}
            packagePath={frame.package}
            onClick={scrollToImage}
            isClickable={shouldShowLinkToImage}
            isHoverPreviewed={isHoverPreviewed}
          >
            {!isHoverPreviewed && (
              <PackageStatus
                status={packageStatus()}
                tooltip={t('Go to Images Loaded')}
              />
            )}
          </PackageLink>
        </PackageInfo>
        {instructionAddr && (
          <TogglableAddress
            address={instructionAddr}
            startingAddress={image ? image.image_addr ?? null : null}
            isAbsolute={traceEventDataSectionContext.display.includes(
              'absolute-addresses'
            )}
            isFoundByStackScanning={isFoundByStackScanning}
            isInlineFrame={!!isInlineFrame}
            relativeAddressMaxlength={maxLengthOfRelativeAddress}
            isHoverPreviewed={isHoverPreviewed}
          />
        )}
        <Symbol
          frame={frame}
          showCompleteFunctionName={traceEventDataSectionContext.display.includes(
            'verbose-function-names'
          )}
          absoluteFilePaths={traceEventDataSectionContext.display.includes(
            'absolute-file-paths'
          )}
          isHoverPreviewed={isHoverPreviewed}
          isUsedForGrouping={isUsedForGrouping}
        />
      </NativeLineContent>
      <Expander
        isExpanded={isExpanded}
        isHoverPreviewed={isHoverPreviewed}
        platform={platform}
        {...props}
      />
    </Wrapper>
  );
}

const PackageInfo = styled('span')`
  display: grid;
  grid-template-columns: auto 1fr;
  order: 2;
  align-items: flex-start;
  @media (min-width: ${props => props.theme.breakpoints.small}) {
    order: 0;
  }
`;

const NativeLineContent = styled('div')<{isFrameAfterLastNonApp: boolean}>`
  display: grid;
  flex: 1;
  gap: ${space(0.5)};
  grid-template-columns: auto 1fr;
  align-items: center;
  justify-content: flex-start;

  @media (min-width: ${props => props.theme.breakpoints.small}) {
    grid-template-columns:
      ${p => (p.isFrameAfterLastNonApp ? '200px' : '150px')} minmax(117px, auto)
      1fr;
  }

  @media (min-width: ${props => props.theme.breakpoints.large}) and (max-width: ${props =>
      props.theme.breakpoints.xlarge}) {
    grid-template-columns:
      ${p => (p.isFrameAfterLastNonApp ? '180px' : '140px')} minmax(117px, auto)
      1fr;
  }
`;
