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
  'onToggleContext' | 'isExpandable' | 'leadsToApp' | 'hasGroupingBadge'
> &
  Omit<
    React.ComponentProps<typeof Default>,
    'onToggleContext' | 'isExpandable' | 'leadsToApp' | 'hasGroupingBadge'
  > & {
    event: Event;
    registers: Record<string, string>;
    components: Array<SentryAppComponent>;
    emptySourceNotation?: boolean;
    isOnlyFrame?: boolean;
  };

function Line({
  frame,
  nextFrame,
  prevFrame,
  timesRepeated,
  includeSystemFrames,
  onAddressToggle,
  onFunctionNameToggle,
  showingAbsoluteAddress,
  showCompleteFunctionName,
  isFrameAfterLastNonApp,
  isUsedForGrouping,
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
  /* Prioritize the frame platform but fall back to the platform
   of the stack trace / exception */
  const platform = getPlatform(frame.platform, props.platform ?? 'other') as PlatformType;
  const leadsToApp = !frame.inApp && ((nextFrame && nextFrame.inApp) || !nextFrame);

  const expandable =
    !leadsToApp || includeSystemFrames
      ? isExpandable({
          frame,
          registers,
          platform,
          emptySourceNotation,
          isOnlyFrame,
        })
      : false;

  const [isExpanded, setIsExpanded] = useState(
    expandable ? props.isExpanded ?? false : false
  );

  function toggleContext(evt: React.MouseEvent) {
    evt.preventDefault();
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
          <Native
            leadsToApp={leadsToApp}
            frame={frame}
            prevFrame={prevFrame}
            nextFrame={nextFrame}
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
            image={image}
            maxLengthOfRelativeAddress={maxLengthOfRelativeAddress}
            isUsedForGrouping={isUsedForGrouping}
          />
        );
      default:
        return (
          <Default
            leadsToApp={leadsToApp}
            frame={frame}
            nextFrame={nextFrame}
            timesRepeated={timesRepeated}
            isHoverPreviewed={isHoverPreviewed}
            platform={platform}
            isExpanded={isExpanded}
            isExpandable={expandable}
            onToggleContext={toggleContext}
            isUsedForGrouping={isUsedForGrouping}
          />
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
    'leads-to-app': leadsToApp,
  });

  return (
    <StyledLi className={className}>
      <StrictClick onClick={expandable ? toggleContext : undefined}>
        {renderLine()}
      </StrictClick>
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
