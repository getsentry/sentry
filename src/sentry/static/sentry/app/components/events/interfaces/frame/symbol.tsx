import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import Tooltip from 'app/components/tooltip';
import {Frame} from 'app/types';
import {defined} from 'app/utils';
import {t} from 'app/locale';
import {IconFilter} from 'app/icons';

import FunctionName from './functionName';
import {getFrameHint} from './utils';

type Props = {
  frame: Frame;
  onFunctionNameToggle: (event: React.MouseEvent<SVGElement>) => void;
  showCompleteFunctionName: boolean;
};

const Symbol = ({frame, onFunctionNameToggle, showCompleteFunctionName}: Props) => {
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

  return (
    <Wrapper>
      <FunctionNameToggleTooltip
        title={functionNameTooltipTitle}
        containerDisplayMode="inline-flex"
      >
        <FunctionNameToggleIcon
          hasFunctionNameHiddenDetails={hasFunctionNameHiddenDetails}
          onClick={hasFunctionNameHiddenDetails ? onFunctionNameToggle : undefined}
          size="xs"
          color="purple400"
        />
      </FunctionNameToggleTooltip>
      <Data>
        <StyledFunctionName
          frame={frame}
          showCompleteFunctionName={showCompleteFunctionName}
          hasHiddenDetails={hasFunctionNameHiddenDetails}
        />
        {hint && (
          <HintStatus>
            <Tooltip title={hint}>{hintIcon}</Tooltip>
          </HintStatus>
        )}
        {frame.filename && (
          <FileNameTooltip title={frame.absPath} disabled={!enablePathTooltip}>
            <Filename>
              {'('}
              {frame.filename}
              {frame.lineNo && `:${frame.lineNo}`}
              {')'}
            </Filename>
          </FileNameTooltip>
        )}
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
    color: ${p => p.theme.gray800};
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
`;

const HintStatus = styled('span')`
  position: relative;
  top: ${space(0.25)};
  margin: 0 ${space(0.75)} 0 -${space(0.25)};
`;

const FileNameTooltip = styled(Tooltip)`
  margin-right: ${space(0.5)};
`;

const Filename = styled('span')`
  color: ${p => p.theme.purple400};
`;

const FunctionNameToggleIcon = styled(IconFilter, {
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
`;

export default Symbol;
export {FunctionNameToggleIcon};
