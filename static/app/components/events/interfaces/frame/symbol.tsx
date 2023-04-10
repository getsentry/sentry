import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/tooltip';
import {SLOW_TOOLTIP_DELAY} from 'sentry/constants';
import {IconFilter} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Frame} from 'sentry/types';
import {defined} from 'sentry/utils';

import {FunctionName} from './functionName';
import GroupingIndicator from './groupingIndicator';
import {getFrameHint} from './utils';

type Props = {
  frame: Frame;
  absoluteFilePaths?: boolean;
  className?: string;
  /**
   * Is the stack trace being previewed in a hovercard?
   */
  isHoverPreviewed?: boolean;
  isUsedForGrouping?: boolean;
  onFunctionNameToggle?: (event: React.MouseEvent<SVGElement>) => void;
  showCompleteFunctionName?: boolean;
};

function Symbol({
  frame,
  absoluteFilePaths,
  onFunctionNameToggle,
  showCompleteFunctionName,
  isHoverPreviewed,
  isUsedForGrouping,
  className,
}: Props) {
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
  const functionNameTooltipTitle = getFunctionNameTooltipTitle();
  const tooltipDelay = isHoverPreviewed ? SLOW_TOOLTIP_DELAY : undefined;

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
        {frame.filename && (
          <Filename>
            {'('}
            {absoluteFilePaths ? frame.absPath : frame.filename}
            {frame.lineNo && `:${frame.lineNo}`}
            {')'}
          </Filename>
        )}
        {isUsedForGrouping && <GroupingIndicator />}
      </Data>
    </Wrapper>
  );
}

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

  @media (min-width: ${props => props.theme.breakpoints.small}) {
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

const Filename = styled('span')`
  color: ${p => p.theme.activeText};
`;

export const FunctionNameToggleIcon = styled(IconFilter, {
  shouldForwardProp: prop => prop !== 'hasFunctionNameHiddenDetails',
})<{
  hasFunctionNameHiddenDetails: boolean;
}>`
  cursor: pointer;
  visibility: hidden;
  display: none;
  @media (min-width: ${p => p.theme.breakpoints.small}) {
    display: block;
  }
  ${p => !p.hasFunctionNameHiddenDetails && 'opacity: 0; cursor: inherit;'};
`;

const FunctionNameToggleTooltip = styled(Tooltip)`
  height: 16px;
  align-items: center;
  margin-right: ${space(0.75)};
  @media (max-width: ${p => p.theme.breakpoints.small}) {
    display: none;
  }
`;

export default Symbol;
