import {Fragment, useEffect, useState} from 'react';
import styled from '@emotion/styled';

import {SeerLoadingIcon, SeerWaitingIcon} from 'sentry/components/ai/SeerIcon';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

import type {AutofixData} from './types';
import type {AutofixProgressDetails} from './utils';
import {getAutofixProgressDetails} from './utils';

interface AutofixProgressBarProps {
  autofixData?: AutofixData;
}

function AutofixProgressBar({autofixData}: AutofixProgressBarProps) {
  const [progressDetails, setProgressDetails] = useState<AutofixProgressDetails>({
    displayText: t('Initializing...'),
    icon: null,
    overallProgress: 0,
  });

  useEffect(() => {
    setProgressDetails(getAutofixProgressDetails(autofixData));
  }, [autofixData]);

  const {displayText, icon, overallProgress} = progressDetails;

  return (
    <ProgressBarContainer hasData={!!autofixData}>
      <ProgressBarWrapper>
        <ProgressBarTrack>
          <ProgressBarFill style={{width: `${overallProgress}%`}} />
        </ProgressBarTrack>
      </ProgressBarWrapper>
      <ProgressBarHoverContent hasData={!!autofixData}>
        {autofixData && (
          <Fragment>
            <LeftContent>
              {icon && (
                <IconContainer>
                  {icon === 'loading' ? (
                    <SeerLoadingIcon size="md" />
                  ) : (
                    <SeerWaitingIcon size="md" />
                  )}
                </IconContainer>
              )}

              <ProgressText>{displayText}</ProgressText>
            </LeftContent>
            <ProgressPercentage>{`${overallProgress}%`}</ProgressPercentage>
          </Fragment>
        )}
      </ProgressBarHoverContent>
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
  transition: ${p => (p.hasData ? 'height 0.2s ease-in-out' : 'none')};

  ${p =>
    p.hasData &&
    `&:hover {
      height: 30px;
    }`}
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
  background-color: ${p => p.theme.border};
`;

const ProgressBarFill = styled('div')`
  height: 100%;
  background-color: ${p => p.theme.pink200};
  transition: width 1s ease-in-out;
`;

const ProgressBarHoverContent = styled('div')<{hasData: boolean}>`
  position: absolute;
  top: 2px;
  left: 0;
  width: 100%;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  box-shadow: ${p => p.theme.dropShadowMedium};
  padding: 0 ${space(3)};
  opacity: 0;
  transition: ${p => (p.hasData ? 'opacity 0.2s ease-in-out' : 'none')};
  background: ${p => p.theme.background}
    linear-gradient(to right, ${p => p.theme.background}, ${p => p.theme.pink400}20);

  ${p =>
    p.hasData &&
    `
    ${ProgressBarContainer}:hover & {
      opacity: 1;
    }`}
`;

const ProgressText = styled('span')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.pink400};
`;

const ProgressPercentage = styled('span')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.pink400};
`;

const IconContainer = styled('div')`
  margin-top: ${space(0.25)};
  margin-right: ${space(0.5)};
`;

const LeftContent = styled('div')`
  display: flex;
  align-items: center;
  color: ${p => p.theme.pink400};
`;

export {AutofixProgressBar};
