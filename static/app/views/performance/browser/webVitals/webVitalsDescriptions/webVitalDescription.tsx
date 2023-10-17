import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import ProgressRing from 'sentry/components/progressRing';
import {IconCheckmark} from 'sentry/icons/iconCheckmark';
import {IconClose} from 'sentry/icons/iconClose';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {WebVital} from 'sentry/utils/fields';
import {Browser} from 'sentry/utils/performance/vitals/constants';
import {getScoreColor} from 'sentry/views/performance/browser/webVitals/utils/getScoreColor';
import {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';
import {
  vitalDescription,
  vitalSupportedBrowsers,
} from 'sentry/views/performance/vitalDetail/utils';

type Props = {
  score: number;
  value: string;
  webVital: WebVitals;
};

const webVitalFullNameMap = {
  cls: t('Cumulative Layout Shift'),
  fcp: t('First Contentful Paint'),
  fid: t('First Input Delay'),
  lcp: t('Largest Contentful Paint'),
  ttfb: t('Time to First Byte'),
};

export function WebVitalDescription({score, value, webVital}: Props) {
  const theme = useTheme();
  let description: string = vitalDescription[WebVital[webVital.toUpperCase()]];
  description = description.slice(0, description.indexOf('At the moment'));
  return (
    <div>
      <Header>
        <span>
          <WebVitalName>{`${webVitalFullNameMap[webVital]} (P75)`}</WebVitalName>
          <Value>{value}</Value>
        </span>
        <ProgressRing
          value={score}
          size={100}
          barWidth={16}
          text={
            <ProgressRingTextContainer>
              <ProgressRingText>{score}</ProgressRingText>
              <ProgressRingSubText>{webVital.toUpperCase()}</ProgressRingSubText>
            </ProgressRingTextContainer>
          }
          progressColor={getScoreColor(score, theme)}
          backgroundColor={`${getScoreColor(score, theme)}33`}
        />
      </Header>
      <p>{description}</p>
      <p>
        <b>
          {`At the moment, there is support for ${webVital.toUpperCase()} in the following browsers:`}
        </b>
      </p>
      <SupportedBrowsers>
        {Object.values(Browser).map(browser => (
          <BrowserItem key={browser}>
            {vitalSupportedBrowsers[WebVital[webVital.toUpperCase()]]?.includes(
              browser
            ) ? (
              <IconCheckmark color="successText" size="sm" />
            ) : (
              <IconClose color="dangerText" size="sm" />
            )}
            {browser}
          </BrowserItem>
        ))}
      </SupportedBrowsers>
    </div>
  );
}

const SupportedBrowsers = styled('div')`
  display: inline-flex;
  gap: ${space(2)};
  margin-bottom: ${space(3)};
`;

const BrowserItem = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const Header = styled('span')`
  display: flex;
  justify-content: space-between;
  margin-bottom: ${space(3)};
`;

const Value = styled('h2')`
  font-weight: normal;
  margin-bottom: ${space(1)};
`;

const WebVitalName = styled('h4')`
  margin-bottom: ${space(1)};
  margin-top: 40px;
`;

const ProgressRingTextContainer = styled('div')`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
`;

const ProgressRingText = styled('h4')`
  color: ${p => p.theme.textColor};
  margin: ${space(2)} 0 0 0;
`;

const ProgressRingSubText = styled('h5')`
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.textColor};
`;
