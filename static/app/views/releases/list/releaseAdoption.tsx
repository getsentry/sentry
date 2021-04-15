import React from 'react';
import styled from '@emotion/styled';
import {withTheme} from 'emotion-theming';

import Count from 'app/components/count';
import ProgressBar from 'app/components/progressBar';
import TextOverflow from 'app/components/textOverflow';
import Tooltip from 'app/components/tooltip';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Theme} from 'app/utils/theme';

import {releaseDisplayLabel} from '../utils';

import {DisplayOption} from './utils';

type Props = {
  adoption: number;
  releaseCount: number;
  projectCount: number;
  displayOption: DisplayOption;
  theme: Theme;
  withLabels?: boolean;
};

function ReleaseAdoption({
  adoption,
  releaseCount,
  projectCount,
  displayOption,
  theme,
  withLabels,
}: Props) {
  return (
    <div>
      {withLabels && (
        <Labels>
          <TextOverflow>
            <Count value={releaseCount} />/<Count value={projectCount} />{' '}
            {releaseDisplayLabel(displayOption, projectCount)}
          </TextOverflow>

          <span>{!adoption ? 0 : adoption < 1 ? '<1' : Math.round(adoption)}%</span>
        </Labels>
      )}

      <Tooltip
        containerDisplayMode="block"
        popperStyle={{
          background: theme.gray500,
          maxWidth: '300px',
        }}
        title={
          <TooltipWrapper>
            <TooltipRow>
              <Title>
                <Dot color={theme.progressBar} />
                {t('This Release')}
              </Title>
              <Value>
                <Count value={releaseCount} />{' '}
                {releaseDisplayLabel(displayOption, releaseCount)}
              </Value>
            </TooltipRow>
            <TooltipRow>
              <Title>
                <Dot color={theme.progressBackground} />
                {t('Total Project')}
              </Title>
              <Value>
                <Count value={projectCount} />{' '}
                {releaseDisplayLabel(displayOption, projectCount)}
              </Value>
            </TooltipRow>
            <Divider />

            <Time>{t('Last 24 hours')}</Time>
          </TooltipWrapper>
        }
      >
        <ProgressBarWrapper>
          <ProgressBar value={Math.ceil(adoption)} />
        </ProgressBarWrapper>
      </Tooltip>
    </div>
  );
}

const Labels = styled('div')`
  display: grid;
  grid-gap: ${space(1)};
  grid-template-columns: 1fr max-content;
`;

const TooltipWrapper = styled('div')`
  padding: ${space(0.75)};
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: 21px;
  font-weight: normal;
`;

const TooltipRow = styled('div')`
  display: grid;
  grid-template-columns: auto auto;
  grid-gap: ${space(3)};
  justify-content: space-between;
  padding-bottom: ${space(0.25)};
`;

const Title = styled('div')`
  text-align: left;
`;

const Dot = styled('div')<{color: string}>`
  display: inline-block;
  margin-right: ${space(0.75)};
  border-radius: 10px;
  width: 10px;
  height: 10px;
  background-color: ${p => p.color};
`;

const Value = styled('div')`
  color: ${p => p.theme.gray300};
  text-align: right;
`;
const Divider = styled('div')`
  border-top: 1px solid ${p => p.theme.gray400};
  margin: ${space(0.75)} -${space(2)} ${space(1)};
`;

const Time = styled('div')`
  color: ${p => p.theme.gray300};
  text-align: center;
`;

const ProgressBarWrapper = styled('div')`
  /* A bit of padding makes hovering for tooltip easier */
  padding: ${space(0.5)} 0;
`;

export default withTheme(ReleaseAdoption);
