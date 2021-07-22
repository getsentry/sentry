import {useState} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import {PackageStatusIcon} from 'app/components/events/interfaces/packageStatus';
import {AddressToggleIcon} from 'app/components/events/interfaces/togglableAddress';
import StrictClick from 'app/components/strictClick';
import {PlatformType, SentryAppComponent} from 'app/types';
import {Event} from 'app/types/event';
import withSentryAppComponents from 'app/utils/withSentryAppComponents';

import Context from '../context';
import {FunctionNameToggleIcon} from '../symbol';
import {
  getPlatform,
  hasAssembly,
  hasContextRegisters,
  hasContextSource,
  hasContextVars,
  isExpandable,
} from '../utils';

import Default from './default';
import Native from './native';

type Props = Omit<
  React.ComponentProps<typeof Native>,
  'onToggleContext' | 'isExpandable' | 'hasGroupingBadge'
> &
  Omit<
    React.ComponentProps<typeof Default>,
    'onToggleContext' | 'isExpandable' | 'hasGroupingBadge'
  > & {
    event: Event;
    registers: Record<string, string>;
    components: Array<SentryAppComponent>;
    emptySourceNotation?: boolean;
    isOnlyFrame?: boolean;
  };

function Line({
  frame,
  prevFrame,
  timesRepeated,
  includeSystemFrames,
  onAddressToggle,
  onFunctionNameToggle,
  showingAbsoluteAddress,
  showCompleteFunctionName,
  isFrameAfterLastNonApp,
  isSentinel,
  isUsedForGrouping,
  isPrefix,
  haveFramesAtLeastOneExpandedFrame,
  haveFramesAtLeastOneGroupingBadge,
  maxLengthOfRelativeAddress,
  image,
  registers,
  isOnlyFrame,
  event,
  components,
  emptySourceNotation = false,
  /**
   * Is the stack trace being previewed in a hovercard?
   */
  isHoverPreviewed = false,
  ...props
}: Props) {
  const [isExpanded, setIsExpanded] = useState(props.isExpanded ?? false);

  /* Prioritize the frame platform but fall back to the platform
   of the stack trace / exception */
  const platform = getPlatform(frame.platform, props.platform ?? 'other') as PlatformType;
  const expandable = isExpandable({
    frame,
    registers,
    platform,
    emptySourceNotation,
    isOnlyFrame,
  });

  function toggleContext(evt?: React.MouseEvent) {
    evt && evt.preventDefault();
    setIsExpanded(!isExpanded);
  }

  function renderLine() {
    switch (platform) {
      case 'objc':
      // fallthrough
      case 'cocoa':
      // fallthrough
      case 'native':
        return (
          <StrictClick onClick={expandable ? toggleContext : undefined}>
            <Native
              frame={frame}
              prevFrame={prevFrame}
              isHoverPreviewed={isHoverPreviewed}
              platform={platform}
              isExpanded={isExpanded}
              isExpandable={expandable}
              onAddressToggle={onAddressToggle}
              onFunctionNameToggle={onFunctionNameToggle}
              includeSystemFrames={includeSystemFrames}
              showingAbsoluteAddress={showingAbsoluteAddress}
              showCompleteFunctionName={showCompleteFunctionName}
              isFrameAfterLastNonApp={isFrameAfterLastNonApp}
              onToggleContext={toggleContext}
              isSentinel={isSentinel}
              isPrefix={isPrefix}
              isUsedForGrouping={isUsedForGrouping}
              haveFramesAtLeastOneExpandedFrame={haveFramesAtLeastOneExpandedFrame}
              haveFramesAtLeastOneGroupingBadge={haveFramesAtLeastOneGroupingBadge}
              image={image}
              maxLengthOfRelativeAddress={maxLengthOfRelativeAddress}
            />
          </StrictClick>
        );
      default:
        return (
          <StrictClick onClick={expandable ? toggleContext : undefined}>
            <Default
              frame={frame}
              timesRepeated={timesRepeated}
              isHoverPreviewed={isHoverPreviewed}
              platform={platform}
              isExpanded={isExpanded}
              isExpandable={expandable}
              onToggleContext={toggleContext}
              isSentinel={isSentinel}
              isPrefix={isPrefix}
              isUsedForGrouping={isUsedForGrouping}
              haveFramesAtLeastOneExpandedFrame={haveFramesAtLeastOneExpandedFrame}
              haveFramesAtLeastOneGroupingBadge={haveFramesAtLeastOneGroupingBadge}
            />
          </StrictClick>
        );
    }
  }

  const className = classNames({
    frame: true,
    'is-expandable': expandable,
    expanded: isExpanded,
    collapsed: !isExpanded,
    'system-frame': !frame.inApp,
    'frame-errors': !!(frame.errors ?? []).length,
  });

  return (
    <StyledLi className={className}>
      {renderLine()}
      <Context
        frame={frame}
        event={event}
        registers={registers}
        components={components}
        hasContextSource={hasContextSource(frame)}
        hasContextVars={hasContextVars(frame)}
        hasContextRegisters={hasContextRegisters(registers)}
        emptySourceNotation={emptySourceNotation}
        hasAssembly={hasAssembly(frame, platform)}
        expandable={expandable}
        isExpanded={isExpanded}
      />
    </StyledLi>
  );
}

export default withSentryAppComponents(Line, {componentType: 'stacktrace-link'});

const StyledLi = styled('li')`
  overflow: hidden;

  ${PackageStatusIcon} {
    flex-shrink: 0;
  }
  :hover {
    ${PackageStatusIcon} {
      visibility: visible;
    }
    ${AddressToggleIcon} {
      visibility: visible;
    }
    ${FunctionNameToggleIcon} {
      visibility: visible;
    }
  }
`;
