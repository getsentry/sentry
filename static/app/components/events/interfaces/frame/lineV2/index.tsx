import {useState} from 'react';
import styled from '@emotion/styled';
import classNames from 'classnames';

import ListItem from 'sentry/components/list/listItem';
import StrictClick from 'sentry/components/strictClick';
import {PlatformType, SentryAppComponent} from 'sentry/types';
import {Event} from 'sentry/types/event';
import withSentryAppComponents from 'sentry/utils/withSentryAppComponents';

import Context from '../context';
import {PackageStatusIcon} from '../packageStatus';
import {FunctionNameToggleIcon} from '../symbol';
import {AddressToggleIcon} from '../togglableAddress';
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
import NativeV2 from './nativeV2';

type Props = Omit<
  React.ComponentProps<typeof Native>,
  'onToggleContext' | 'isExpandable' | 'leadsToApp' | 'hasGroupingBadge'
> &
  Omit<
    React.ComponentProps<typeof Default>,
    'onToggleContext' | 'isExpandable' | 'leadsToApp' | 'hasGroupingBadge'
  > & {
    components: Array<SentryAppComponent>;
    event: Event;
    registers: Record<string, string>;
    emptySourceNotation?: boolean;
    frameMeta?: Record<string, any>;
    isOnlyFrame?: boolean;
    nativeV2?: boolean;
    registersMeta?: Record<string, any>;
  };

function Line({
  frame,
  debugFrames,
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
  frameMeta,
  registersMeta,
  emptySourceNotation = false,
  /**
   * Is the stack trace being previewed in a hovercard?
   */
  isHoverPreviewed = false,
  nativeV2 = false,
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
      case 'cocoa':
      case 'native':
        return nativeV2 ? (
          <NativeV2
            event={event}
            leadsToApp={leadsToApp}
            frame={frame}
            prevFrame={prevFrame}
            nextFrame={nextFrame}
            isHoverPreviewed={isHoverPreviewed}
            platform={platform}
            isExpanded={isExpanded}
            isExpandable={expandable}
            includeSystemFrames={includeSystemFrames}
            isFrameAfterLastNonApp={isFrameAfterLastNonApp}
            onToggleContext={toggleContext}
            image={image}
            maxLengthOfRelativeAddress={maxLengthOfRelativeAddress}
            isUsedForGrouping={isUsedForGrouping}
          />
        ) : (
          <Native
            event={event}
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
            event={event}
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
            frameMeta={frameMeta}
            debugFrames={debugFrames}
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
    <StyleListItem className={className} data-test-id="stack-trace-frame">
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
        registersMeta={registersMeta}
        frameMeta={frameMeta}
      />
    </StyleListItem>
  );
}

export default withSentryAppComponents(Line, {componentType: 'stacktrace-link'});

const StyleListItem = styled(ListItem)`
  overflow: hidden;

  :first-child {
    border-top: none;
  }

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
