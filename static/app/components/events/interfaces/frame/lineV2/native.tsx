import {MouseEvent, MouseEventHandler} from 'react';
import styled from '@emotion/styled';
import scrollToElement from 'scroll-to-element';

import DebugImage from 'app/components/events/interfaces/debugMeta/debugImage';
import {combineStatus} from 'app/components/events/interfaces/debugMeta/utils';
import PackageLink from 'app/components/events/interfaces/packageLink';
import PackageStatus from 'app/components/events/interfaces/packageStatus';
import TogglableAddress from 'app/components/events/interfaces/togglableAddress';
import {SymbolicatorStatus} from 'app/components/events/interfaces/types';
import {t} from 'app/locale';
import {DebugMetaActions} from 'app/stores/debugMetaStore';
import space from 'app/styles/space';
import {Frame} from 'app/types';

import Symbol from '../symbol';
import {getPlatform} from '../utils';

import Expander from './expander';
import LeadHint from './leadHint';
import Wrapper from './wrapper';

type Props = React.ComponentProps<typeof Expander> &
  React.ComponentProps<typeof LeadHint> & {
    frame: Frame;
    isUsedForGrouping: boolean;
    onMouseDown?: MouseEventHandler<HTMLDivElement>;
    onClick?: () => void;
    isFrameAfterLastNonApp?: boolean;
    includeSystemFrames?: boolean;
    showingAbsoluteAddress?: boolean;
    showCompleteFunctionName?: boolean;
    prevFrame?: Frame;
    image?: React.ComponentProps<typeof DebugImage>['image'];
    maxLengthOfRelativeAddress?: number;
    onAddressToggle?: (event: React.MouseEvent<SVGElement>) => void;
    onFunctionNameToggle?: (event: React.MouseEvent<SVGElement>) => void;
  };

function Native({
  frame,
  isFrameAfterLastNonApp,
  isExpanded,
  isHoverPreviewed,
  onAddressToggle,
  image,
  includeSystemFrames,
  showingAbsoluteAddress,
  showCompleteFunctionName,
  onFunctionNameToggle,
  maxLengthOfRelativeAddress,
  platform,
  prevFrame,
  isUsedForGrouping,
  nextFrame,
  leadsToApp,
  onMouseDown,
  onClick,
  ...props
}: Props) {
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

  function scrollToImage(event: MouseEvent<HTMLAnchorElement>) {
    event.stopPropagation(); // to prevent collapsing if collapsable

    if (instructionAddr) {
      DebugMetaActions.updateFilter(makeFilter(instructionAddr));
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
            startingAddress={image ? image.image_addr : null}
            isAbsolute={!!showingAbsoluteAddress}
            isFoundByStackScanning={isFoundByStackScanning}
            isInlineFrame={!!isInlineFrame}
            onToggle={onAddressToggle}
            relativeAddressMaxlength={maxLengthOfRelativeAddress}
            isHoverPreviewed={isHoverPreviewed}
          />
        )}
        <Symbol
          frame={frame}
          showCompleteFunctionName={!!showCompleteFunctionName}
          onFunctionNameToggle={onFunctionNameToggle}
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

export default Native;

const PackageInfo = styled('span')`
  display: grid;
  grid-template-columns: auto 1fr;
  order: 2;
  align-items: flex-start;
  @media (min-width: ${props => props.theme.breakpoints[0]}) {
    order: 0;
  }
`;

const NativeLineContent = styled('div')<{isFrameAfterLastNonApp: boolean}>`
  display: grid;
  flex: 1;
  grid-gap: ${space(0.5)};
  grid-template-columns: auto 1fr;
  align-items: center;
  justify-content: flex-start;

  @media (min-width: ${props => props.theme.breakpoints[0]}) {
    grid-template-columns:
      ${p => (p.isFrameAfterLastNonApp ? '200px' : '150px')} minmax(117px, auto)
      1fr;
  }

  @media (min-width: ${props => props.theme.breakpoints[2]}) and (max-width: ${props =>
      props.theme.breakpoints[3]}) {
    grid-template-columns:
      ${p => (p.isFrameAfterLastNonApp ? '180px' : '140px')} minmax(117px, auto)
      1fr;
  }
`;
