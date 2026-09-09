import type {MouseEvent} from 'react';
import {Fragment, useState} from 'react';
import {css, type Theme} from '@emotion/react';
import styled from '@emotion/styled';

import {Tag} from '@sentry/scraps/badge';
import {Button} from '@sentry/scraps/button';
import InteractionStateLayer from '@sentry/scraps/interactionStateLayer';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {FRAME_TOOLTIP_MAX_WIDTH} from 'sentry/components/events/interfaces/frame/defaultTitle';
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
import {useStacktraceContext} from 'sentry/components/events/interfaces/stackTraceContext';
import {formatAddress, parseAddress} from 'sentry/components/events/interfaces/utils';
import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import {StrictClick} from 'sentry/components/strictClick';
import {SLOW_TOOLTIP_DELAY} from 'sentry/constants';
import {IconChevron} from 'sentry/icons';
import {IconFileBroken} from 'sentry/icons/iconFileBroken';
import {IconRefresh} from 'sentry/icons/iconRefresh';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t, tn} from 'sentry/locale';
import type {ImageWithCombinedStatus} from 'sentry/types/debugImage';
import type {Event, Frame} from 'sentry/types/event';
import type {SentryAppSchemaStacktraceLink} from 'sentry/types/integrations';
import type {PlatformKey} from 'sentry/types/platform';
import {StackView, type StacktraceType} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils/defined';
import {useSentryAppComponentsStore} from 'sentry/utils/useSentryAppComponentsStore';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {SectionKey, useIssueDetails} from 'sentry/views/issueDetails/context';
import {getFoldSectionKey} from 'sentry/views/issueDetails/foldSection';

import {useOptionalDebugMetaSearch} from './debugMeta/debugMetaSearchContext';
import {combineStatus} from './debugMeta/utils';
import {Context} from './frame/context';
import {SymbolicatorStatus} from './types';

type Props = {
  emptySourceNotation: boolean;
  event: Event;
  frame: Frame;
  frameMeta: Record<any, any>;
  hiddenFrameCount: number | undefined;
  image: ImageWithCombinedStatus;
  isFirstInAppFrame: boolean;
  /**
   * Is the stack trace being previewed in a hovercard?
   */
  isHoverPreviewed: boolean | undefined;
  isShowFramesToggleExpanded: boolean;
  /**
   * Frames that are hidden under the most recent non-InApp frame
   */
  isSubFrame: boolean;
  isUsedForGrouping: boolean;
  maxLengthOfRelativeAddress: number;
  nextFrame: Frame;
  onShowFramesToggle: (event: React.MouseEvent<HTMLElement>) => void;
  platform: PlatformKey;
  prevFrame: Frame | undefined;
  registers: StacktraceType['registers'];
  registersMeta: Record<any, any>;
};

export function NativeFrame({
  frame,
  nextFrame,
  prevFrame,
  isUsedForGrouping,
  maxLengthOfRelativeAddress,
  image,
  registers,
  event,
  hiddenFrameCount,
  isFirstInAppFrame,
  isShowFramesToggleExpanded,
  isSubFrame,
  onShowFramesToggle,
  platform,
  registersMeta,
  frameMeta,
  emptySourceNotation,
  isHoverPreviewed = false,
}: Props) {
  const components = useSentryAppComponentsStore<SentryAppSchemaStacktraceLink>({
    componentType: 'stacktrace-link',
  });
  const isDartAsyncSuspensionFrame =
    frame.filename === '<asynchronous suspension>' ||
    frame.absPath === '<asynchronous suspension>';
  const {displayOptions, stackView, hasScmSourceContext} = useStacktraceContext();

  const {sectionData} = useIssueDetails();
  const debugMetaSearch = useOptionalDebugMetaSearch();
  const debugSectionConfig = sectionData[SectionKey.DEBUGMETA];
  const [_isCollapsed, setIsCollapsed] = useSyncedLocalStorageState(
    getFoldSectionKey(SectionKey.DEBUGMETA),
    debugSectionConfig?.initialCollapse ?? false
  );
  const fullStackTrace = stackView === StackView.FULL;

  const absolute = displayOptions.includes('absolute-addresses');
  const fullFunctionName = displayOptions.includes('verbose-function-names');
  const absoluteFilePaths = displayOptions.includes('absolute-file-paths');

  const tooltipDelay = isHoverPreviewed ? SLOW_TOOLTIP_DELAY : undefined;
  const foundByStackScanning = frame.trust === 'scan' || frame.trust === 'cfi-scan';
  const startingAddress = image ? image.image_addr : null;
  const packageClickable =
    !!frame.symbolicatorStatus &&
    frame.symbolicatorStatus !== SymbolicatorStatus.UNKNOWN_IMAGE &&
    !isHoverPreviewed &&
    !!debugSectionConfig &&
    !!debugMetaSearch;

  const leadsToApp = !frame.inApp && (nextFrame?.inApp || !nextFrame);
  const expandable = isExpandable({
    frame,
    registers,
    platform,
    emptySourceNotation,
    hasScmSourceContext,
  });

  const inlineFrame =
    prevFrame &&
    platform === (prevFrame.platform || platform) &&
    frame.instructionAddr === prevFrame.instructionAddr;

  const functionNameHiddenDetails =
    defined(frame.rawFunction) &&
    defined(frame.function) &&
    frame.function !== frame.rawFunction;

  const [expanded, setExpanded] = useState(() => isFirstInAppFrame);
  const [isHovering, setHovering] = useState(false);

  const contextLine = (frame?.context || []).find(l => l[0] === frame.lineNo);
  const showStacktraceLink = frame.inApp && !!frame.filename && (isHovering || expanded);
  const showSentryAppStacktraceLinkInFrame = showStacktraceLink && components.length > 0;

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

    return;
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

    return;
  }

  // this is the status of image that belongs to this frame
  function getStatus() {
    // Treat Dart asynchronous suspension frames as symbolicated - these are synthetic markers set by Dart
    if (isDartAsyncSuspensionFrame) {
      return 'success';
    }

    // If a matching debug image doesn't exist, fall back to symbolicator_status
    if (!image) {
      switch (frame.symbolicatorStatus) {
        case SymbolicatorStatus.SYMBOLICATED:
          return 'success';
        case SymbolicatorStatus.MISSING:
        case SymbolicatorStatus.MALFORMED:
          return 'error';
        case SymbolicatorStatus.UNKNOWN_IMAGE:
          return frame.instructionAddr === '0x0' ? 'success' : 'error';
        case SymbolicatorStatus.MISSING_SYMBOL:
        default:
          return;
      }
    }

    const combinedStatus = combineStatus(image.debug_status, image.unwind_status);

    switch (combinedStatus) {
      case 'unused':
        return;
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

      debugMetaSearch?.setSearchTerm(searchTerm);
    }

    // Expand the section
    setIsCollapsed(false);

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
        <Grid
          align="center"
          alignContent="center"
          as="span"
          css={theme =>
            rowHeaderCss(theme, {
              expandable: !!expandable,
              isInAppFrame: frame.inApp,
              isSubFrame: !!isSubFrame,
            })
          }
          data-row-header
          gap="0 md"
          minHeight={{xl: '32px'}}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          padding={{zero: 'md', xl: 'xs lg'}}
          position="relative"
          rows="1fr"
        >
          {expandable ? <InteractionStateLayer /> : null}
          <Container width="14px">
            {status === 'error' ? (
              <Tooltip
                title={t(
                  'This frame has missing debug files and could not be symbolicated'
                )}
              >
                <IconFileBroken
                  size="sm"
                  variant="danger"
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
                  variant="warning"
                  data-test-id="symbolication-warning-icon"
                />
              </Tooltip>
            ) : null}
          </Container>
          <div>
            {!fullStackTrace && !expanded && leadsToApp && (
              <Fragment>
                <Text as="div" size="xs" variant="muted">
                  {getLeadHint({event, hasNextFrame: defined(nextFrame)})}
                </Text>
              </Fragment>
            )}
            <Tooltip
              title={
                frame.package ??
                (isDartAsyncSuspensionFrame
                  ? t('Dart async operation')
                  : t('Go to images loaded'))
              }
              containerDisplayMode="inline-flex"
              delay={tooltipDelay}
              maxWidth={FRAME_TOOLTIP_MAX_WIDTH}
              position="auto-start"
            >
              <Package>
                {frame.package
                  ? trimPackage(frame.package)
                  : isDartAsyncSuspensionFrame
                    ? t('Dart async')
                    : `<${t('unknown')}>`}
              </Package>
            </Tooltip>
          </div>
          <Flex>
            <AddressCell onClick={packageClickable ? handleGoToImagesLoaded : undefined}>
              <Tooltip
                title={addressTooltip}
                disabled={!(foundByStackScanning || inlineFrame)}
                delay={tooltipDelay}
                maxWidth={FRAME_TOOLTIP_MAX_WIDTH}
              >
                {!relativeAddress || absolute ? frame.instructionAddr : relativeAddress}
              </Tooltip>
            </AddressCell>
          </Flex>
          <Text wordBreak="break-all">
            {({className}) => (
              <Container className={className} column={{zero: '2 / 6', xl: 'auto'}}>
                {functionName ? (
                  <Tooltip
                    title={frame?.rawFunction ?? frame?.symbol}
                    delay={tooltipDelay}
                  >
                    <AnnotatedText value={functionName.value} meta={functionName.meta} />
                  </Tooltip>
                ) : isDartAsyncSuspensionFrame ? (
                  t('Dart')
                ) : (
                  `<${t('unknown')}>`
                )}{' '}
                {frame.filename && (
                  <Tooltip
                    title={frame.absPath}
                    disabled={
                      !(defined(frame.absPath) && frame.absPath !== frame.filename)
                    }
                    delay={tooltipDelay}
                    maxWidth={FRAME_TOOLTIP_MAX_WIDTH}
                  >
                    <FileName>
                      {'('}
                      {absoluteFilePaths ? frame.absPath : frame.filename}
                      {frame.lineNo && `:${frame.lineNo}`}
                      {')'}
                    </FileName>
                  </Tooltip>
                )}
              </Container>
            )}
          </Text>
          <Container row={{zero: '2 / 3', xl: 'auto'}}>
            {isUsedForGrouping && (
              <Tooltip title={t('This frame is repeated in every event of this issue')}>
                <IconRefresh size="sm" variant="primary" />
              </Tooltip>
            )}
          </Container>
          {hiddenFrameCount ? (
            <ShowHideButton
              analyticsEventName="Stacktrace Frames: toggled"
              analyticsEventKey="stacktrace_frames.toggled"
              analyticsParams={{
                frame_count: hiddenFrameCount,
                is_frame_expanded: isShowFramesToggleExpanded,
              }}
              size="zero"
              variant="transparent"
              onClick={e => {
                onShowFramesToggle?.(e);
              }}
            >
              {isShowFramesToggleExpanded
                ? tn('Hide %s more frame', 'Hide %s more frames', hiddenFrameCount)
                : tn('Show %s more frame', 'Show %s more frames', hiddenFrameCount)}
            </ShowHideButton>
          ) : null}
          <Flex align="center" gap="sm">
            {showStacktraceLink && (
              <ErrorBoundary>
                <StacktraceLink
                  frame={frame}
                  line={contextLine ? contextLine[1] : ''}
                  event={event}
                  disableSetup={isHoverPreviewed}
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
            <Container
              column={{zero: '5 / 6', xl: 'auto'}}
              row={{zero: '1 / 2', xl: 'auto'}}
            >
              {frame.inApp ? <Tag variant="info">{t('In App')}</Tag> : null}
            </Container>
          </Flex>
          <Container
            column={{zero: '6 / 7', xl: 'auto'}}
            row={{zero: '1 / 2', xl: 'auto'}}
          >
            {expandable && (
              <ToggleButton
                type="button"
                size="zero"
                variant="transparent"
                aria-label={expanded ? t('Collapse Context') : t('Expand Context')}
                icon={<IconChevron size="sm" direction={expanded ? 'up' : 'down'} />}
              />
            )}
          </Container>
        </Grid>
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
          hasScmSourceContext={hasScmSourceContext}
          isExpanded={expanded}
          registersMeta={registersMeta}
          frameMeta={frameMeta}
          platform={platform}
        />
      )}
    </StackTraceFrame>
  );
}

const AddressCell = styled('div')`
  font-family: ${p => p.theme.font.family.mono};
  ${p => p.onClick && 'cursor: pointer'};
  ${p => p.onClick && 'color:' + p.theme.tokens.interactive.link.accent.rest};
`;

const ToggleButton = styled(Button)`
  display: block;
  color: ${p => p.theme.tokens.content.secondary};
`;

const Registers = styled(Context)`
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  padding: 0;
  margin: 0;
`;

const Package = styled('span')`
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  width: 100%;
  padding-right: 2px; /* Needed to prevent text cropping with italic font */
`;

const FileName = styled('span')`
  color: ${p => p.theme.tokens.content.secondary};
  border-bottom: 1px dashed ${p => p.theme.tokens.border.primary};
`;

const rowHeaderCss = (
  theme: Theme,
  {
    expandable,
    isInAppFrame,
    isSubFrame,
  }: {
    expandable: boolean;
    isInAppFrame: boolean;
    isSubFrame: boolean;
  }
) => css`
  grid-template-columns: auto 150px 120px 4fr repeat(3, auto) ${theme.space.xl};
  background-color: ${
    !isInAppFrame && isSubFrame
      ? theme.colors.surface200
      : theme.tokens.background.secondary
  };
  font-size: ${theme.font.size.sm};
  color: ${isInAppFrame ? '' : theme.tokens.content.secondary};
  font-style: ${isInAppFrame ? '' : 'italic'};
  ${expandable && 'cursor: pointer;'};
`;

const StackTraceFrame = styled('li')`
  :not(:last-child) {
    [data-row-header] {
      border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
    }
  }
`;

const ShowHideButton = styled(Button)`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
  font-style: italic;
  font-weight: ${p => p.theme.font.weight.sans.regular};
  padding: ${p => p.theme.space['2xs']} ${p => p.theme.space.xs};
  &:hover {
    color: ${p => p.theme.tokens.content.secondary};
  }
`;
