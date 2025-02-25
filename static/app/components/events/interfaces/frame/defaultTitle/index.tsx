import {Fragment} from 'react';
import styled from '@emotion/styled';

import {AnnotatedText} from 'sentry/components/events/meta/annotatedText';
import ExternalLink from 'sentry/components/links/externalLink';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {Tooltip} from 'sentry/components/tooltip';
import Truncate from 'sentry/components/truncate';
import {SLOW_TOOLTIP_DELAY} from 'sentry/constants';
import {IconOpen, IconQuestion} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Frame} from 'sentry/types/event';
import type {Meta} from 'sentry/types/group';
import type {PlatformKey} from 'sentry/types/project';
import {defined} from 'sentry/utils';
import {isUrl} from 'sentry/utils/string/isUrl';

import {FunctionName} from '../functionName';
import GroupingIndicator from '../groupingIndicator';
import {getPlatform, isDotnet, trimPackage} from '../utils';

type Props = {
  frame: Frame;
  platform: PlatformKey;
  /**
   * The origin URL of the event that contains this frame. Used to determine if the frame
   * comes from a different origin than the application code.
   */
  eventOrigin?: string;
  /**
   * Is the stack trace being previewed in a hovercard?
   */
  isHoverPreviewed?: boolean;
  isUsedForGrouping?: boolean;
  meta?: Record<any, any>;
};

type GetPathNameOutput = {key: string; value: string; meta?: Meta};

function DefaultTitle({
  frame,
  platform,
  isHoverPreviewed,
  isUsedForGrouping,
  meta,
  eventOrigin,
}: Props) {
  const title: React.ReactElement[] = [];
  const framePlatform = getPlatform(frame.platform, platform);
  const tooltipDelay = isHoverPreviewed ? SLOW_TOOLTIP_DELAY : undefined;

  const handleExternalLink = (event: React.MouseEvent<HTMLAnchorElement>) => {
    event.stopPropagation();
  };

  const getModule = (): GetPathNameOutput | undefined => {
    if (frame.module) {
      return {
        key: 'module',
        value: frame.module,
        meta: meta?.module?.[''],
      };
    }

    return undefined;
  };

  const getPathNameOrModule = (
    shouldPrioritizeModuleName: boolean
  ): GetPathNameOutput | undefined => {
    if (shouldPrioritizeModuleName) {
      if (frame.module) {
        return getModule();
      }
      if (frame.filename) {
        return {
          key: 'filename',
          value: frame.filename,
          meta: meta?.filename?.[''],
        };
      }
      return undefined;
    }

    if (frame.filename) {
      return {
        key: 'filename',
        value: frame.filename,
        meta: meta?.filename?.[''],
      };
    }

    if (frame.module) {
      return getModule();
    }

    return undefined;
  };

  // TODO(dcramer): this needs to use a formatted string so it can be
  // localized correctly
  if (defined(frame.filename || frame.module)) {
    // prioritize module name for Java as filename is often only basename
    const shouldPrioritizeModuleName = framePlatform === 'java';

    const pathNameOrModule = getPathNameOrModule(shouldPrioritizeModuleName);
    const enablePathTooltip =
      defined(frame.absPath) && frame.absPath !== pathNameOrModule?.value;
    const isExternalUrl =
      eventOrigin &&
      frame.absPath &&
      isUrl(frame.absPath) &&
      !frame.absPath.startsWith(eventOrigin);

    if (pathNameOrModule) {
      title.push(
        <Tooltip
          key={pathNameOrModule.key}
          title={frame.absPath}
          disabled={!enablePathTooltip}
          delay={tooltipDelay}
        >
          <code key="filename" className="filename" data-test-id="filename">
            {isExternalUrl && frame.absPath ? (
              <Truncate value={frame.absPath} maxLength={100} leftTrim />
            ) : !!pathNameOrModule.meta && !pathNameOrModule.value ? (
              <AnnotatedText
                value={pathNameOrModule.value}
                meta={pathNameOrModule.meta}
              />
            ) : (
              <Truncate value={pathNameOrModule.value} maxLength={100} leftTrim />
            )}
          </code>
        </Tooltip>
      );
    }

    // in case we prioritized the module name but we also have a filename info
    // we want to show a litle (?) icon that on hover shows the actual filename
    if (shouldPrioritizeModuleName && frame.filename) {
      title.push(
        <Tooltip key={frame.filename} title={frame.filename} delay={tooltipDelay}>
          <a className="in-at real-filename">
            <IconQuestion size="xs" />
          </a>
        </Tooltip>
      );
    }

    if (frame.absPath && isUrl(frame.absPath)) {
      title.push(
        <StyledExternalLink href={frame.absPath} key="share" onClick={handleExternalLink}>
          <IconOpen size="xs" />
        </StyledExternalLink>
      );
    }

    if (
      (defined(frame.function) || defined(frame.rawFunction)) &&
      defined(pathNameOrModule)
    ) {
      title.push(
        <InFramePosition className="in-at" key="in">
          {` ${t('in')} `}
        </InFramePosition>
      );
    }
  }

  if (defined(frame.function) || defined(frame.rawFunction)) {
    title.push(
      <FunctionName
        frame={frame}
        key="function"
        className="function"
        data-test-id="function"
        meta={meta}
      />
    );
  }

  // we don't want to render out zero line numbers which are used to
  // indicate lack of source information for native setups.  We could
  // TODO(mitsuhiko): only do this for events from native platforms?
  if (defined(frame.lineNo) && frame.lineNo !== 0) {
    title.push(
      <InFramePosition className="in-at in-at-line" key="no">
        {` ${t('at line')} `}
      </InFramePosition>
    );
    title.push(
      <code key="line" className="lineno">
        {defined(frame.colNo) ? `${frame.lineNo}:${frame.colNo}` : frame.lineNo}
      </code>
    );
  }

  if (defined(frame.package) && !isDotnet(framePlatform)) {
    title.push(<InFramePosition key="within">{` ${t('within')} `}</InFramePosition>);
    title.push(
      <code title={frame.package} className="package" key="package">
        {trimPackage(frame.package)}
      </code>
    );
  }

  if (defined(frame.origAbsPath) && (frame.mapUrl || frame.map)) {
    const text = (frame.mapUrl ?? frame.map) as string;
    title.push(
      <StyledQuestionTooltip
        key="info-tooltip"
        isHoverable
        size="xs"
        delay={tooltipDelay}
        overlayStyle={{maxWidth: 400, wordBreak: 'break-all'}}
        skipWrapper
        title={
          <Fragment>
            <div>
              <strong>{t('Source Map')}</strong>
            </div>
            {text}
          </Fragment>
        }
      />
    );
  }

  if (isUsedForGrouping) {
    title.push(<StyledGroupingIndicator key="info-tooltip" />);
  }

  return <Fragment>{title}</Fragment>;
}

export default DefaultTitle;

const StyledExternalLink = styled(ExternalLink)`
  position: relative;
  top: ${space(0.25)};
  margin-left: ${space(0.5)};
`;

const InFramePosition = styled('span')`
  color: ${p => p.theme.textColor};
  opacity: 0.6;
`;

const StyledGroupingIndicator = styled(GroupingIndicator)`
  margin-left: ${space(0.75)};
`;

const StyledQuestionTooltip = styled(QuestionTooltip)`
  margin-left: ${space(0.5)};
`;
