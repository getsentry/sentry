import * as React from 'react';
import styled from '@emotion/styled';

import {STACKTRACE_PREVIEW_TOOLTIP_DELAY} from 'app/components/stacktracePreview';
import Tooltip from 'app/components/tooltip';
import {IconFilter} from 'app/icons';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Frame} from 'app/types';
import {defined} from 'app/utils';

import FunctionName from './functionName';
import GroupingIndicator from './groupingIndicator';
import {getFrameHint} from './utils';

type Props = {
  frame: Frame;
  absoluteFilePaths?: boolean;
  showCompleteFunctionName?: boolean;
  nativeStackTraceV2?: boolean;
  isUsedForGrouping?: boolean;
  onFunctionNameToggle?: (event: React.MouseEvent<SVGElement>) => void;
  /**
   * Is the stack trace being previewed in a hovercard?
   */
  isHoverPreviewed?: boolean;
  className?: string;
};

const Symbol = ({
  frame,
  absoluteFilePaths,
  onFunctionNameToggle,
  showCompleteFunctionName,
  nativeStackTraceV2,
  isHoverPreviewed,
  isUsedForGrouping,
  className,
}: Props) => {
  const hasFunctionNameHiddenDetails =
    defined(frame.rawFunction) &&
    defined(frame.function) &&
    frame.function !== frame.rawFunction;

  const getFunctionNameTooltipTitle = () => {
    if (!hasFunctionNameHiddenDetails) {
      return undefined;
    }

    if (!showCompleteFunctionName) {
      return t('Expand function details');
    }

    return t('Hide function details');
  };

  const [hint, hintIcon] = getFrameHint(frame);
  const enablePathTooltip = defined(frame.absPath) && frame.absPath !== frame.filename;
  const functionNameTooltipTitle = getFunctionNameTooltipTitle();
  const tooltipDelay = isHoverPreviewed ? STACKTRACE_PREVIEW_TOOLTIP_DELAY : undefined;

  return (
    <Wrapper className={className}>
      {onFunctionNameToggle && (
        <FunctionNameToggleTooltip
          title={functionNameTooltipTitle}
          containerDisplayMode="inline-flex"
          delay={tooltipDelay}
        >
          <FunctionNameToggleIcon
            hasFunctionNameHiddenDetails={hasFunctionNameHiddenDetails}
            onClick={hasFunctionNameHiddenDetails ? onFunctionNameToggle : undefined}
            size="xs"
            color="purple300"
          />
        </FunctionNameToggleTooltip>
      )}
      <Data>
        <StyledFunctionName
          frame={frame}
          showCompleteFunctionName={showCompleteFunctionName}
          hasHiddenDetails={hasFunctionNameHiddenDetails}
        />
        {hint && (
          <HintStatus>
            <Tooltip title={hint} delay={tooltipDelay}>
              {hintIcon}
            </Tooltip>
          </HintStatus>
        )}
        {frame.filename &&
          (nativeStackTraceV2 ? (
            <Filename>
              {'('}
              {absoluteFilePaths ? frame.absPath : frame.filename}
              {frame.lineNo && `:${frame.lineNo}`}
              {')'}
            </Filename>
          ) : (
            <FileNameTooltip
              title={frame.absPath}
              disabled={!enablePathTooltip}
              delay={tooltipDelay}
            >
              <Filename>
                {'('}
                {frame.filename}
                {frame.lineNo && `:${frame.lineNo}`}
                {')'}
              </Filename>
            </FileNameTooltip>
          ))}
        {isUsedForGrouping && <GroupingIndicator />}
      </Data>
    </Wrapper>
  );
};

const Wrapper = styled('div')`
  text-align: left;
  grid-column-start: 1;
  grid-column-end: -1;
  order: 3;
  flex: 1;

  display: flex;

  code {
    background: transparent;
    color: ${p => p.theme.textColor};
    padding-right: ${space(0.5)};
  }

  @media (min-width: ${props => props.theme.breakpoints[0]}) {
    order: 0;
    grid-column-start: auto;
    grid-column-end: auto;
  }
`;

const StyledFunctionName = styled(FunctionName)`
  margin-right: ${space(0.75)};
`;

const Data = styled('div')`
  max-width: 100%;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
`;

const HintStatus = styled('span')`
  position: relative;
  top: ${space(0.25)};
  margin: 0 ${space(0.75)} 0 -${space(0.25)};
`;

const FileNameTooltip = styled(Tooltip)`
  margin-right: ${space(0.75)};
`;

const Filename = styled('span')`
  color: ${p => p.theme.purple300};
`;

export const FunctionNameToggleIcon = styled(IconFilter, {
  shouldForwardProp: prop => prop !== 'hasFunctionNameHiddenDetails',
})<{
  hasFunctionNameHiddenDetails: boolean;
}>`
  cursor: pointer;
  visibility: hidden;
  display: none;
  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    display: block;
  }
  ${p => !p.hasFunctionNameHiddenDetails && 'opacity: 0; cursor: inherit;'};
`;

const FunctionNameToggleTooltip = styled(Tooltip)`
  height: 16px;
  align-items: center;
  margin-right: ${space(0.75)};
  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    display: none;
  }
`;

export default Symbol;
