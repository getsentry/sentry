import {useEffect, useState} from 'react';
import styled from '@emotion/styled';

import type {AutofixData} from './types';
import type {AutofixProgressDetails} from './utils';
import {getAutofixProgressDetails} from './utils';

interface AutofixProgressBarProps {
  autofixData?: AutofixData;
}

function AutofixProgressBar({autofixData}: AutofixProgressBarProps) {
  const [progressDetails, setProgressDetails] = useState<AutofixProgressDetails>({
    overallProgress: 0,
  });

  useEffect(() => {
    setProgressDetails(getAutofixProgressDetails(autofixData));
  }, [autofixData]);

  const {overallProgress} = progressDetails;

  return (
    <ProgressBarContainer hasData={!!autofixData}>
      <ProgressBarWrapper>
        <ProgressBarTrack>
          <ProgressBarFill style={{width: `${overallProgress}%`}} />
        </ProgressBarTrack>
      </ProgressBarWrapper>
    </ProgressBarContainer>
  );
}

const ProgressBarContainer = styled('div')<{hasData: boolean}>`
  position: sticky;
  top: 0;
  left: 0;
  right: 0;
  width: 100%;
  height: 2px;
  transition: height 0.2s ease-in-out;
`;

const ProgressBarWrapper = styled('div')`
  position: relative;
  width: 100%;
  height: 100%;
`;

const ProgressBarTrack = styled('div')`
  position: absolute;
  width: 100%;
  height: 2px;
  background-color: ${p => p.theme.tokens.border.secondary};
`;

const ProgressBarFill = styled('div')`
  height: 100%;
  background-color: ${p => p.theme.tokens.interactive.link.accent.active};
  opacity: 0.7;
  transition: width 1s ease-in-out;
`;

export {AutofixProgressBar};
