import {MouseEvent} from 'react';
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
import GroupingBadges from './groupingBadges';
import LeadHint from './leadHint';

type Props = React.ComponentProps<typeof Expander> &
  React.ComponentProps<typeof LeadHint> &
  Omit<React.ComponentProps<typeof GroupingBadges>, 'inApp'> & {
    frame: Frame;
    leadsToApp: boolean;
    hasGroupingBadge: boolean;
    isFrameAfterLastNonApp?: boolean;
    includeSystemFrames?: boolean;
    showingAbsoluteAddress?: boolean;
    showCompleteFunctionName?: boolean;
    nextFrame?: Frame;
    prevFrame?: Frame;
    image?: React.ComponentProps<typeof DebugImage>['image'];
    maxLengthOfRelativeAddress?: number;
    haveFramesAtLeastOneExpandedFrame?: boolean;
    haveFramesAtLeastOneGroupingBadge?: boolean;
    onAddressToggle?: (event: React.MouseEvent<SVGElement>) => void;
    onFunctionNameToggle?: (event: React.MouseEvent<SVGElement>) => void;
  };

function Native({
  frame,
  isFrameAfterLastNonApp,
  isExpanded,
  nextFrame,
  leadsToApp,
  hasGroupingBadge,
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
  isPrefix,
  isSentinel,
  isUsedForGrouping,
  haveFramesAtLeastOneExpandedFrame,
  haveFramesAtLeastOneGroupingBadge,
  ...props
}: Props) {
  const {instructionAddr, trust, addrMode, inApp, symbolicatorStatus} = frame ?? {};

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
    <Wrapper
      className="title as-table"
      haveFramesAtLeastOneExpandedFrame={haveFramesAtLeastOneExpandedFrame}
      haveFramesAtLeastOneGroupingBadge={haveFramesAtLeastOneGroupingBadge}
    >
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
        />
      </NativeLineContent>
      {hasGroupingBadge && (
        <GroupingBadges
          inApp={inApp}
          isPrefix={isPrefix}
          isSentinel={isSentinel}
          isUsedForGrouping={isUsedForGrouping}
        />
      )}
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

const Wrapper = styled('div')<{
  haveFramesAtLeastOneExpandedFrame?: boolean;
  haveFramesAtLeastOneGroupingBadge?: boolean;
}>`
  display: grid;
  grid-template-columns: ${p =>
    p.haveFramesAtLeastOneGroupingBadge && p.haveFramesAtLeastOneExpandedFrame
      ? '1.5fr 0.5fr 16px'
      : p.haveFramesAtLeastOneGroupingBadge
      ? '1fr 0.5fr'
      : p.haveFramesAtLeastOneExpandedFrame
      ? '1fr 16px'
      : '1fr'};

  grid-gap: ${space(1)};

  @media (min-width: ${props => props.theme.breakpoints[0]}) {
    align-items: center;
  }
`;

const NativeLineContent = styled('div')<{isFrameAfterLastNonApp: boolean}>`
  display: grid;
  flex: 1;
  grid-gap: ${space(0.5)};
  grid-template-columns: ${p =>
    `minmax(${p.isFrameAfterLastNonApp ? '167px' : '117px'}, auto)  1fr`};
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

const PackageInfo = styled('div')`
  display: grid;
  grid-template-columns: auto 1fr;
  order: 2;
  align-items: flex-start;
  @media (min-width: ${props => props.theme.breakpoints[0]}) {
    order: 0;
  }
`;
