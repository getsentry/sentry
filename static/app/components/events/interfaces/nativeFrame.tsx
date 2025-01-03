import type {MouseEvent} from 'react';
import {Fragment, useContext, useState} from 'react';
import styled from '@emotion/styled';

import Tag from 'sentry/components/badge/tag';
import {Button} from 'sentry/components/button';
import {Chevron} from 'sentry/components/chevron';
import ErrorBoundary from 'sentry/components/errorBoundary';
import {OpenInContextLine} from 'sentry/components/events/interfaces/frame/openInContextLine';
import {StacktraceLink} from 'sentry/components/events/interfaces/frame/stacktraceLink';
import {
  getLeadHint,
  hasAssembly,
  hasContextRegisters,
  hasContextSource,
  hasContextVars,
  isExpandable,
  trimPackage,
} from 'sentry/components/events/interfaces/frame/utils';
import {formatAddress, parseAddress} from 'sentry/components/events/interfaces/utils';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {TraceEventDataSectionContext} from 'sentry/components/events/traceEventDataSection';
import InteractionStateLayer from 'sentry/components/interactionStateLayer';
import StrictClick from 'sentry/components/strictClick';
import {Tooltip} from 'sentry/components/tooltip';
import {SLOW_TOOLTIP_DELAY} from 'sentry/constants';
import {IconFileBroken} from 'sentry/icons/iconFileBroken';
import {IconRefresh} from 'sentry/icons/iconRefresh';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t, tn} from 'sentry/locale';
import DebugMetaStore from 'sentry/stores/debugMetaStore';
import {space} from 'sentry/styles/space';
import type {Event, Frame} from 'sentry/types/event';
import type {
  SentryAppComponent,
  SentryAppSchemaStacktraceLink,
} from 'sentry/types/integrations';
import type {PlatformKey} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import withSentryAppComponents from 'sentry/utils/withSentryAppComponents';
import {SectionKey, useIssueDetails} from 'sentry/views/issueDetails/streamline/context';
import {getFoldSectionKey} from 'sentry/views/issueDetails/streamline/foldSection';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

import type DebugImage from './debugMeta/debugImage';
import {combineStatus} from './debugMeta/utils';
import Context from './frame/context';
import {SymbolicatorStatus} from './types';

type Props = {
  components: SentryAppComponent<SentryAppSchemaStacktraceLink>[];
  event: Event;
  frame: Frame;
  isUsedForGrouping: boolean;
  platform: PlatformKey;
  registers: Record<string, string>;
  emptySourceNotation?: boolean;
  frameMeta?: Record<any, any>;
  hiddenFrameCount?: number;
  image?: React.ComponentProps<typeof DebugImage>['image'];
  includeSystemFrames?: boolean;
  isExpanded?: boolean;
  isHoverPreviewed?: boolean;
  isOnlyFrame?: boolean;
  isShowFramesToggleExpanded?: boolean;
  /**
   * Frames that are hidden under the most recent non-InApp frame
   */
  isSubFrame?: boolean;
  maxLengthOfRelativeAddress?: number;
  nextFrame?: Frame;
  onShowFramesToggle?: (event: React.MouseEvent<HTMLElement>) => void;
  prevFrame?: Frame;
  registersMeta?: Record<any, any>;
  showStackedFrames?: boolean;
};

function NativeFrame({
  frame,
  nextFrame,
  prevFrame,
  isUsedForGrouping,
  maxLengthOfRelativeAddress,
  image,
  registers,
  isOnlyFrame,
  event,
  components,
  hiddenFrameCount,
  isShowFramesToggleExpanded,
  isSubFrame,
  onShowFramesToggle,
  platform,
  registersMeta,
  frameMeta,
  emptySourceNotation = false,
  /**
   * Is the stack trace being previewed in a hovercard?
   */
  isHoverPreviewed = false,
}: Props) {
  const traceEventDataSectionContext = useContext(TraceEventDataSectionContext);

  const {sectionData} = useIssueDetails();
  const debugSectionConfig = sectionData[SectionKey.DEBUGMETA];
  const [_isCollapsed, setIsCollapsed] = useSyncedLocalStorageState(
    getFoldSectionKey(SectionKey.DEBUGMETA),
    debugSectionConfig?.initialCollapse ?? false
  );
  const hasStreamlinedUI = useHasStreamlinedUI();

  const absolute = traceEventDataSectionContext?.display.includes('absolute-addresses');

  const fullStackTrace = traceEventDataSectionContext?.fullStackTrace;

  const fullFunctionName = traceEventDataSectionContext?.display.includes(
    'verbose-function-names'
  );

  const absoluteFilePaths =
    traceEventDataSectionContext?.display.includes('absolute-file-paths');

  const tooltipDelay = isHoverPreviewed ? SLOW_TOOLTIP_DELAY : undefined;
  const foundByStackScanning = frame.trust === 'scan' || frame.trust === 'cfi-scan';
  const startingAddress = image ? image.image_addr : null;
  const packageClickable =
    !!frame.symbolicatorStatus &&
    frame.symbolicatorStatus !== SymbolicatorStatus.UNKNOWN_IMAGE &&
    !isHoverPreviewed &&
    // We know the debug section is rendered (only once streamline ui is enabled)
    (hasStreamlinedUI ? !!debugSectionConfig : true);

  const leadsToApp = !frame.inApp && (nextFrame?.inApp || !nextFrame);
  const expandable = isExpandable({
    frame,
    registers,
    platform,
    emptySourceNotation,
    isOnlyFrame,
  });

  const inlineFrame =
    prevFrame &&
    platform === (prevFrame.platform || platform) &&
    frame.instructionAddr === prevFrame.instructionAddr;

  const functionNameHiddenDetails =
    defined(frame.rawFunction) &&
    defined(frame.function) &&
    frame.function !== frame.rawFunction;

  const [expanded, setExpanded] = useState(true);
  const [isHovering, setHovering] = useState(false);

  const contextLine = (frame?.context || []).find(l => l[0] === frame.lineNo);
  const hasStacktraceLink = frame.inApp && !!frame.filename && (isHovering || expanded);
  const showSentryAppStacktraceLinkInFrame = hasStacktraceLink && components.length > 0;

  const handleMouseEnter = () => setHovering(true);

  const handleMouseLeave = () => setHovering(false);

  function getRelativeAddress() {
    if (!startingAddress) {
      return '';
    }

    const relativeAddress = formatAddress(
      parseAddress(frame.instructionAddr) - parseAddress(startingAddress),
      maxLengthOfRelativeAddress
    );

    return `+${relativeAddress}`;
  }

  function getAddressTooltip() {
    if (inlineFrame && foundByStackScanning) {
      return t('Inline frame, found by stack scanning');
    }

    if (inlineFrame) {
      return t('Inline frame');
    }

    if (foundByStackScanning) {
      return t('Found by stack scanning');
    }

    return undefined;
  }

  function getFunctionName() {
    if (functionNameHiddenDetails && fullFunctionName && frame.rawFunction) {
      return {
        value: frame.rawFunction,
        meta: frameMeta?.rawFunction?.[''],
      };
    }

    if (frame.function) {
      return {
        value: frame.function,
        meta: frameMeta?.function?.[''],
      };
    }

    return undefined;
  }

  // this is the status of image that belongs to this frame
  function getStatus() {
    // If a matching debug image doesn't exist, fall back to symbolicator_status
    if (!image) {
      switch (frame.symbolicatorStatus) {
        case SymbolicatorStatus.SYMBOLICATED:
          return 'success';
        case SymbolicatorStatus.MISSING:
        case SymbolicatorStatus.MALFORMED:
          return 'error';
        case SymbolicatorStatus.MISSING_SYMBOL:
        case SymbolicatorStatus.UNKNOWN_IMAGE:
        default:
          return undefined;
      }
    }

    const combinedStatus = combineStatus(image.debug_status, image.unwind_status);

    switch (combinedStatus) {
      case 'unused':
        return undefined;
      case 'found':
        return 'success';
      default:
        return 'error';
    }
  }

  // This isn't possible when the page doesn't have the images loaded section
  function handleGoToImagesLoaded(e: MouseEvent) {
    e.stopPropagation(); // to prevent collapsing if collapsible

    if (frame.instructionAddr) {
      const searchTerm =
        !(!frame.addrMode || frame.addrMode === 'abs') && image
          ? `${image.debug_id}!${frame.instructionAddr}`
          : frame.instructionAddr;

      DebugMetaStore.updateFilter(searchTerm);
    }

    if (hasStreamlinedUI) {
      // Expand the section
      setIsCollapsed(false);
    }

    // Scroll to the section
    document
      .getElementById(SectionKey.DEBUGMETA)
      ?.scrollIntoView({block: 'start', behavior: 'smooth'});
  }

  function handleToggleContext(e: MouseEvent) {
    if (!expandable) {
      return;
    }
    e.preventDefault();
    setExpanded(!expanded);
  }

  const relativeAddress = getRelativeAddress();
  const addressTooltip = getAddressTooltip();
  const functionName = getFunctionName();
  const status = getStatus();

  return (
    <StackTraceFrame data-test-id="stack-trace-frame">
      <StrictClick onClick={handleToggleContext}>
        <RowHeader
          expandable={expandable}
          isInAppFrame={frame.inApp}
          isSubFrame={!!isSubFrame}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          {expandable ? <InteractionStateLayer /> : null}
          <SymbolicatorIcon>
            {status === 'error' ? (
              <Tooltip
                title={t(
                  'This frame has missing debug files and could not be symbolicated'
                )}
              >
                <IconFileBroken
                  size="sm"
                  color="errorText"
                  data-test-id="symbolication-error-icon"
                />
              </Tooltip>
            ) : status === undefined ? (
              <Tooltip
                title={t(
                  'This frame has an unknown problem and could not be symbolicated'
                )}
              >
                <IconWarning
                  size="sm"
                  color="warningText"
                  data-test-id="symbolication-warning-icon"
                />
              </Tooltip>
            ) : null}
          </SymbolicatorIcon>
          <div>
            {!fullStackTrace && !expanded && leadsToApp && (
              <Fragment>
                <PackageNote>
                  {getLeadHint({event, hasNextFrame: defined(nextFrame)})}
                </PackageNote>
              </Fragment>
            )}
            <Tooltip
              title={frame.package ?? t('Go to images loaded')}
              position="bottom"
              containerDisplayMode="inline-flex"
              delay={tooltipDelay}
            >
              <Package>
                {frame.package ? trimPackage(frame.package) : `<${t('unknown')}>`}
              </Package>
            </Tooltip>
          </div>
          <GenericCellWrapper>
            <AddressCell onClick={packageClickable ? handleGoToImagesLoaded : undefined}>
              <Tooltip
                title={addressTooltip}
                disabled={!(foundByStackScanning || inlineFrame)}
                delay={tooltipDelay}
              >
                {!relativeAddress || absolute ? frame.instructionAddr : relativeAddress}
              </Tooltip>
            </AddressCell>
          </GenericCellWrapper>
          <FunctionNameCell>
            {functionName ? (
              <Tooltip title={frame?.rawFunction ?? frame?.symbol} delay={tooltipDelay}>
                <AnnotatedText value={functionName.value} meta={functionName.meta} />
              </Tooltip>
            ) : (
              `<${t('unknown')}>`
            )}{' '}
            {frame.filename && (
              <Tooltip
                title={frame.absPath}
                disabled={!(defined(frame.absPath) && frame.absPath !== frame.filename)}
                delay={tooltipDelay}
                isHoverable
              >
                <FileName>
                  {'('}
                  {absoluteFilePaths ? frame.absPath : frame.filename}
                  {frame.lineNo && `:${frame.lineNo}`}
                  {')'}
                </FileName>
              </Tooltip>
            )}
          </FunctionNameCell>
          <GroupingCell>
            {isUsedForGrouping && (
              <Tooltip title={t('This frame is repeated in every event of this issue')}>
                <IconRefresh size="sm" color="textColor" />
              </Tooltip>
            )}
          </GroupingCell>
          {hiddenFrameCount ? (
            <ShowHideButton
              analyticsEventName="Stacktrace Frames: toggled"
              analyticsEventKey="stacktrace_frames.toggled"
              analyticsParams={{
                frame_count: hiddenFrameCount,
                is_frame_expanded: isShowFramesToggleExpanded,
              }}
              size="zero"
              borderless
              onClick={e => {
                onShowFramesToggle?.(e);
              }}
            >
              {isShowFramesToggleExpanded
                ? tn('Hide %s more frame', 'Hide %s more frames', hiddenFrameCount)
                : tn('Show %s more frame', 'Show %s more frames', hiddenFrameCount)}
            </ShowHideButton>
          ) : null}
          <GenericCellWrapper>
            {hasStacktraceLink && (
              <ErrorBoundary>
                <StacktraceLink
                  frame={frame}
                  line={contextLine ? contextLine[1] : ''}
                  event={event}
                />
              </ErrorBoundary>
            )}
            {showSentryAppStacktraceLinkInFrame && (
              <ErrorBoundary mini>
                <OpenInContextLine
                  lineNo={frame.lineNo}
                  filename={frame.filename || ''}
                  components={components}
                />
              </ErrorBoundary>
            )}
            <TypeCell>
              {frame.inApp ? <Tag type="info">{t('In App')}</Tag> : null}
            </TypeCell>
          </GenericCellWrapper>
          <ExpandCell>
            {expandable && (
              <ToggleButton
                size="zero"
                borderless
                aria-label={t('Toggle Context')}
                tooltipProps={isHoverPreviewed ? {delay: SLOW_TOOLTIP_DELAY} : undefined}
                icon={<Chevron size="medium" direction={expanded ? 'up' : 'down'} />}
              />
            )}
          </ExpandCell>
        </RowHeader>
      </StrictClick>
      {expanded && (
        <Registers
          frame={frame}
          event={event}
          registers={registers}
          components={components}
          hasContextSource={hasContextSource(frame)}
          hasContextVars={hasContextVars(frame)}
          hasContextRegisters={hasContextRegisters(registers)}
          emptySourceNotation={emptySourceNotation}
          hasAssembly={hasAssembly(frame, platform)}
          isExpanded={expanded}
          registersMeta={registersMeta}
          frameMeta={frameMeta}
          platform={platform}
        />
      )}
    </StackTraceFrame>
  );
}

export default withSentryAppComponents(NativeFrame, {componentType: 'stacktrace-link'});

const GenericCellWrapper = styled('div')`
  display: flex;
`;

const AddressCell = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  ${p => p.onClick && `cursor: pointer`};
  ${p => p.onClick && `color:` + p.theme.linkColor};
`;

const FunctionNameCell = styled('div')`
  word-break: break-all;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-column: 2/6;
  }
`;

const GroupingCell = styled('div')`
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-row: 2/3;
  }
`;

const TypeCell = styled('div')`
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-column: 5/6;
    grid-row: 1/2;
  }
`;

const ExpandCell = styled('div')`
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    grid-column: 6/7;
    grid-row: 1/2;
  }
`;

const ToggleButton = styled(Button)`
  display: block;
  color: ${p => p.theme.subText};
`;

const Registers = styled(Context)`
  border-bottom: 1px solid ${p => p.theme.border};
  padding: 0;
  margin: 0;
`;

const PackageNote = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeExtraSmall};
`;

const Package = styled('span')`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  padding-right: 2px; /* Needed to prevent text cropping with italic font */
`;

const FileName = styled('span')`
  color: ${p => p.theme.subText};
  border-bottom: 1px dashed ${p => p.theme.border};
`;

const RowHeader = styled('span')<{
  expandable: boolean;
  isInAppFrame: boolean;
  isSubFrame: boolean;
}>`
  position: relative;
  display: grid;
  grid-template-columns: auto 150px 120px 4fr repeat(3, auto) ${space(2)}; /* Adjusted to account for the extra element */
  grid-template-rows: 1fr; /* Ensures a single row */
  align-items: center;
  align-content: center;
  column-gap: ${space(1)};
  background-color: ${p =>
    !p.isInAppFrame && p.isSubFrame
      ? `${p.theme.surface100}`
      : `${p.theme.bodyBackground}`};
  font-size: ${p => p.theme.fontSizeSmall};
  padding: ${space(1)};
  color: ${p => (!p.isInAppFrame ? p.theme.subText : '')};
  font-style: ${p => (!p.isInAppFrame ? 'italic' : '')};
  ${p => p.expandable && `cursor: pointer;`};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: auto 150px 120px 4fr repeat(3, auto) ${space(2)}; /* Matches the updated desktop layout */
    padding: ${space(0.5)} ${space(1.5)};
    min-height: 32px;
  }
`;

const StackTraceFrame = styled('li')`
  :not(:last-child) {
    ${RowHeader} {
      border-bottom: 1px solid ${p => p.theme.border};
    }
  }
`;

const SymbolicatorIcon = styled('div')`
  width: ${p => p.theme.iconSizes.sm};
`;

const ShowHideButton = styled(Button)`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeSmall};
  font-style: italic;
  font-weight: ${p => p.theme.fontWeightNormal};
  padding: ${space(0.25)} ${space(0.5)};
  &:hover {
    color: ${p => p.theme.subText};
  }
`;
