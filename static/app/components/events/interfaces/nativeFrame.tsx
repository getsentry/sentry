import {Fragment, MouseEvent, useContext, useState} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';
import scrollToElement from 'scroll-to-element';

import Button from 'sentry/components/button';
import {
  hasAssembly,
  hasContextRegisters,
  hasContextSource,
  hasContextVars,
  isDotnet,
  isExpandable,
  trimPackage,
} from 'sentry/components/events/interfaces/frame/utils';
import {formatAddress, parseAddress} from 'sentry/components/events/interfaces/utils';
import AnnotatedText from 'sentry/components/events/meta/annotatedText';
import {getMeta} from 'sentry/components/events/meta/metaProxy';
import {TraceEventDataSectionContext} from 'sentry/components/events/traceEventDataSection';
import {DisplayOption} from 'sentry/components/events/traceEventDataSection/displayOptions';
import {STACKTRACE_PREVIEW_TOOLTIP_DELAY} from 'sentry/components/stacktracePreview';
import StrictClick from 'sentry/components/strictClick';
import Tooltip from 'sentry/components/tooltip';
import {IconChevron} from 'sentry/icons/iconChevron';
import {IconInfo} from 'sentry/icons/iconInfo';
import {IconQuestion} from 'sentry/icons/iconQuestion';
import {IconWarning} from 'sentry/icons/iconWarning';
import {t} from 'sentry/locale';
import {DebugMetaActions} from 'sentry/stores/debugMetaStore';
import space from 'sentry/styles/space';
import {Frame, PlatformType, SentryAppComponent} from 'sentry/types';
import {Event} from 'sentry/types/event';
import {defined} from 'sentry/utils';
import {Color} from 'sentry/utils/theme';
import withSentryAppComponents from 'sentry/utils/withSentryAppComponents';

import DebugImage from './debugMeta/debugImage';
import {combineStatus} from './debugMeta/utils';
import Context from './frame/context';
import {SymbolicatorStatus} from './types';

type Props = {
  components: Array<SentryAppComponent>;
  event: Event;
  frame: Frame;
  isUsedForGrouping: boolean;
  platform: PlatformType;
  registers: Record<string, string>;
  emptySourceNotation?: boolean;
  image?: React.ComponentProps<typeof DebugImage>['image'];
  includeSystemFrames?: boolean;
  isExpanded?: boolean;
  isHoverPreviewed?: boolean;
  isOnlyFrame?: boolean;
  maxLengthOfRelativeAddress?: number;
  nextFrame?: Frame;
  prevFrame?: Frame;
};

function NativeFrame({
  frame,
  nextFrame,
  prevFrame,
  includeSystemFrames,
  isUsedForGrouping,
  maxLengthOfRelativeAddress,
  image,
  registers,
  isOnlyFrame,
  event,
  components,
  isExpanded,
  platform,
  emptySourceNotation = false,
  /**
   * Is the stack trace being previewed in a hovercard?
   */
  isHoverPreviewed = false,
}: Props) {
  const traceEventDataSectionContext = useContext(TraceEventDataSectionContext);

  const absolute = traceEventDataSectionContext?.activeDisplayOptions.includes(
    DisplayOption.ABSOLUTE_ADDRESSES
  );

  const fullStackTrace = traceEventDataSectionContext?.activeDisplayOptions.includes(
    DisplayOption.FULL_STACK_TRACE
  );

  const fullFunctionName = traceEventDataSectionContext?.activeDisplayOptions.includes(
    DisplayOption.VERBOSE_FUNCTION_NAMES
  );

  const absoluteFilePaths = traceEventDataSectionContext?.activeDisplayOptions.includes(
    DisplayOption.ABSOLUTE_FILE_PATHS
  );

  const tooltipDelay = isHoverPreviewed ? STACKTRACE_PREVIEW_TOOLTIP_DELAY : undefined;
  const foundByStackScanning = frame.trust === 'scan' || frame.trust === 'cfi-scan';
  const startingAddress = image ? image.image_addr : null;
  const packageClickable =
    !!frame.symbolicatorStatus &&
    frame.symbolicatorStatus !== SymbolicatorStatus.UNKNOWN_IMAGE &&
    !isHoverPreviewed;

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

  const inlineFrame =
    prevFrame &&
    platform === (prevFrame.platform || platform) &&
    frame.instructionAddr === prevFrame.instructionAddr;

  const functionNameHiddenDetails =
    defined(frame.rawFunction) &&
    defined(frame.function) &&
    frame.function !== frame.rawFunction;

  const [expanded, setExpanded] = useState(expandable ? isExpanded ?? false : false);

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
        meta: getMeta(frame, 'rawFunction'),
      };
    }

    if (frame.function) {
      return {
        value: frame.function,
        meta: getMeta(frame, 'function'),
      };
    }

    return undefined;
  }

  function getStatus() {
    // this is the status of image that belongs to this frame
    if (!image) {
      return undefined;
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

  function handleGoToImagesLoaded(e: MouseEvent) {
    e.stopPropagation(); // to prevent collapsing if collapsible

    if (frame.instructionAddr) {
      const searchTerm =
        !(!frame.addrMode || frame.addrMode === 'abs') && image
          ? `${image.debug_id}!${frame.instructionAddr}`
          : frame.instructionAddr;

      DebugMetaActions.updateFilter(searchTerm);
    }

    scrollToElement('#images-loaded');
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
    <GridRow
      inApp={frame.inApp}
      expandable={expandable}
      expanded={expanded}
      data-test-id="stack-trace-frame"
    >
      <StrictClick onClick={handleToggleContext}>
        <StrictClickContent>
          <StatusCell>
            {(status === 'error' || status === undefined) &&
              (packageClickable ? (
                <PackageStatusButton
                  onClick={handleGoToImagesLoaded}
                  title={t('Go to images loaded')}
                  aria-label={t('Go to images loaded')}
                  icon={
                    status === 'error' ? (
                      <IconQuestion size="sm" color="red300" />
                    ) : (
                      <IconWarning size="sm" color="red300" />
                    )
                  }
                  size="zero"
                  borderless
                />
              ) : status === 'error' ? (
                <IconQuestion size="sm" color="red300" />
              ) : (
                <IconWarning size="sm" color="red300" />
              ))}
          </StatusCell>
          <PackageCell>
            {!fullStackTrace && !expanded && leadsToApp && (
              <Fragment>
                {!nextFrame ? t('Crashed in non-app') : t('Called from')}
                {':'}&nbsp;
              </Fragment>
            )}
            <span>
              <Tooltip
                title={frame.package ?? t('Go to images loaded')}
                delay={tooltipDelay}
                disabled={frame.package ? false : !packageClickable}
                containerDisplayMode="inline-flex"
              >
                <Package
                  color={
                    status === undefined || status === 'error'
                      ? 'red300'
                      : packageClickable
                      ? 'blue300'
                      : undefined
                  }
                  onClick={packageClickable ? handleGoToImagesLoaded : undefined}
                >
                  {frame.package ? trimPackage(frame.package) : `<${t('unknown')}>`}
                </Package>
              </Tooltip>
            </span>
          </PackageCell>
          <AddressCell>
            <Tooltip
              title={addressTooltip}
              disabled={!(foundByStackScanning || inlineFrame)}
              delay={tooltipDelay}
            >
              {!relativeAddress || absolute ? frame.instructionAddr : relativeAddress}
            </Tooltip>
          </AddressCell>
          <GroupingCell>
            {isUsedForGrouping && (
              <Tooltip
                title={t('This frame appears in all other events related to this issue')}
                containerDisplayMode="inline-flex"
              >
                <IconInfo size="sm" color="gray300" />
              </Tooltip>
            )}
          </GroupingCell>
          <FunctionNameCell>
            <FunctionName>
              {functionName ? (
                <AnnotatedText value={functionName.value} meta={functionName.meta} />
              ) : (
                `<${t('unknown')}>`
              )}
            </FunctionName>
            {frame.filename && (
              <Tooltip
                title={frame.absPath}
                disabled={!(defined(frame.absPath) && frame.absPath !== frame.filename)}
                delay={tooltipDelay}
                containerDisplayMode="inline-flex"
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
          <ExpandCell>
            {expandable && (
              <ToggleButton
                size="zero"
                css={isDotnet(platform) && {display: 'block !important'}} // remove important once we get rid of css files
                title={t('Toggle Context')}
                aria-label={t('Toggle Context')}
                tooltipProps={
                  isHoverPreviewed ? {delay: STACKTRACE_PREVIEW_TOOLTIP_DELAY} : undefined
                }
                icon={<IconChevron size="8px" direction={expanded ? 'up' : 'down'} />}
              />
            )}
          </ExpandCell>
        </StrictClickContent>
      </StrictClick>
      <RegistersCell>
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
            expandable={expandable}
            isExpanded={expanded}
          />
        )}
      </RegistersCell>
    </GridRow>
  );
}

export default withSentryAppComponents(NativeFrame, {componentType: 'stacktrace-link'});

const Cell = styled('div')`
  padding: ${space(0.5)};
  display: flex;
  flex-wrap: wrap;
  word-break: break-all;
  align-items: flex-start;
`;

const StatusCell = styled(Cell)`
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-column: 1/1;
    grid-row: 1/1;
  }
`;

const PackageCell = styled(Cell)`
  color: ${p => p.theme.subText};
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-column: 2/2;
    grid-row: 1/1;
    display: grid;
    grid-template-columns: 1fr;
    grid-template-rows: repeat(2, auto);
  }
`;

const AddressCell = styled(Cell)`
  font-family: ${p => p.theme.text.familyMono};
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-column: 3/3;
    grid-row: 1/1;
  }
`;

const GroupingCell = styled(Cell)`
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-column: 1/1;
    grid-row: 2/2;
  }
`;

const FunctionNameCell = styled(Cell)`
  color: ${p => p.theme.textColor};
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-column: 2/-1;
    grid-row: 2/2;
  }
`;

const ExpandCell = styled(Cell)``;

const RegistersCell = styled('div')`
  grid-column: 1/-1;
  margin-left: -${space(0.5)};
  margin-right: -${space(0.5)};
  cursor: default;
`;

const Registers = styled(Context)`
  padding: 0;
  margin: 0;
`;

const ToggleButton = styled(Button)`
  width: 16px;
  height: 16px;
`;

const Package = styled('span')<{color?: Color}>`
  border-bottom: 1px dashed ${p => p.theme.border};
  ${p => p.color && `color: ${p.theme[p.color]}`};
  ${p => p.onClick && `cursor: pointer;`}
`;

const FunctionName = styled('div')`
  color: ${p => p.theme.headingColor};
  margin-right: ${space(1)};
`;

const FileName = styled('span')`
  color: ${p => p.theme.subText};
  border-bottom: 1px dashed ${p => p.theme.border};
`;

const PackageStatusButton = styled(Button)`
  padding: 0;
  border: none;
`;

const GridRow = styled('div')<{expandable: boolean; expanded: boolean; inApp: boolean}>`
  ${p => p.expandable && `cursor: pointer;`};
  ${p => p.inApp && `background: ${p.theme.bodyBackground};`};
  ${p =>
    !p.inApp &&
    css`
      color: ${p.theme.subText};
      ${FunctionName} {
        color: ${p.theme.subText};
      }
      ${FunctionNameCell} {
        color: ${p.theme.subText};
      }
    `};

  display: grid;
  align-items: flex-start;
  padding: ${space(0.5)};
  :not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.border};
  }

  grid-template-columns: 24px 132px 138px 24px 1fr 24px;
  grid-template-rows: 1fr;

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: 24px auto minmax(138px, 1fr) 24px;
    grid-template-rows: repeat(2, auto);
  }
`;

const StrictClickContent = styled('div')`
  display: contents;
`;
