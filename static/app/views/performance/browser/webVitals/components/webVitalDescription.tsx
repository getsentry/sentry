import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {COUNTRY_CODE_TO_NAME_MAP} from 'sentry/data/countryCodesMap';
import {IconCheckmark} from 'sentry/icons/iconCheckmark';
import {IconClose} from 'sentry/icons/iconClose';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Tag} from 'sentry/types';
import {WebVital} from 'sentry/utils/fields';
import {Browser} from 'sentry/utils/performance/vitals/constants';
import {Dot} from 'sentry/views/performance/browser/webVitals/components/webVitalMeters';
import {PERFORMANCE_SCORE_COLORS} from 'sentry/views/performance/browser/webVitals/utils/performanceScoreColors';
import {
  scoreToStatus,
  STATUS_TEXT,
} from 'sentry/views/performance/browser/webVitals/utils/scoreToStatus';
import {
  ProjectScore,
  WebVitals,
} from 'sentry/views/performance/browser/webVitals/utils/types';
import {vitalSupportedBrowsers} from 'sentry/views/performance/vitalDetail/utils';

import PerformanceScoreRingWithTooltips from './performanceScoreRingWithTooltips';

type Props = {
  score: number;
  value: string;
  webVital: WebVitals;
};

const WEB_VITAL_FULL_NAME_MAP = {
  cls: t('Cumulative Layout Shift'),
  fcp: t('First Contentful Paint'),
  fid: t('First Input Delay'),
  lcp: t('Largest Contentful Paint'),
  ttfb: t('Time to First Byte'),
};

const VITAL_DESCRIPTIONS: Partial<Record<WebVital, string>> = {
  [WebVital.FCP]: t(
    'First Contentful Paint (FCP) measures the amount of time the first content takes to render in the viewport. Like FP, this could also show up in any form from the document object model (DOM), such as images, SVGs, or text blocks.'
  ),
  [WebVital.CLS]: t(
    'Cumulative Layout Shift (CLS) is the sum of individual layout shift scores for every unexpected element shift during the rendering process. Imagine navigating to an article and trying to click a link before the page finishes loading. Before your cursor even gets there, the link may have shifted down due to an image rendering. Rather than using duration for this Web Vital, the CLS score represents the degree of disruptive and visually unstable shifts.'
  ),
  [WebVital.FID]: t(
    'First Input Delay (FID) measures the response time when the user tries to interact with the viewport. Actions maybe include clicking a button, link or other custom Javascript controller. It is key in helping the user determine if a page is usable or not.'
  ),
  [WebVital.LCP]: t(
    'Largest Contentful Paint (LCP) measures the render time for the largest content to appear in the viewport. This may be in any form from the document object model (DOM), such as images, SVGs, or text blocks. It’s the largest pixel area in the viewport, thus most visually defining. LCP helps developers understand how long it takes to see the main content on the page.'
  ),
  [WebVital.TTFB]: t(
    'Time to First Byte (TTFB) is a foundational metric for measuring connection setup time and web server responsiveness in both the lab and the field. It helps identify when a web server is too slow to respond to requests. In the case of navigation requests—that is, requests for an HTML document—it precedes every other meaningful loading performance metric.'
  ),
};

type WebVitalDetailHeaderProps = {
  isProjectScoreCalculated: boolean;
  projectScore: ProjectScore;
  tag: Tag;
  value: React.ReactNode;
};

export function WebVitalDetailHeader({score, value, webVital}: Props) {
  const theme = useTheme();
  const colors = theme.charts.getColorPalette(3);
  const dotColor = colors[['lcp', 'fcp', 'fid', 'cls', 'ttfb'].indexOf(webVital)];
  const status = scoreToStatus(score);

  return (
    <Header>
      <span>
        <WebVitalName>{`${WEB_VITAL_FULL_NAME_MAP[webVital]} (P75)`}</WebVitalName>
        <Value>
          <Dot color={dotColor} />
          {value}
        </Value>
      </span>
      <ScoreBadge status={status}>
        <StatusText>{STATUS_TEXT[status]}</StatusText>
        <StatusScore>{score}</StatusScore>
      </ScoreBadge>
    </Header>
  );
}

export function WebVitalTagsDetailHeader({
  projectScore,
  value,
  tag,
  isProjectScoreCalculated,
}: WebVitalDetailHeaderProps) {
  const theme = useTheme();
  const ringSegmentColors = theme.charts.getColorPalette(3);
  const ringBackgroundColors = ringSegmentColors.map(color => `${color}50`);
  const title =
    tag.key === 'geo.country_code' ? COUNTRY_CODE_TO_NAME_MAP[tag.name] : tag.name;
  return (
    <Header>
      <span>
        <TitleWrapper>
          <WebVitalName>{title}</WebVitalName>
          <StyledCopyToClipboardButton
            borderless
            text={`${tag.key}:${tag.name}`}
            size="sm"
            iconSize="sm"
          />
        </TitleWrapper>
        <Value>{value}</Value>
      </span>
      {isProjectScoreCalculated && projectScore ? (
        <PerformanceScoreRingWithTooltips
          hideWebVitalLabels
          projectScore={projectScore}
          text={projectScore.totalScore}
          width={100}
          height={100}
          ringBackgroundColors={ringBackgroundColors}
          ringSegmentColors={ringSegmentColors}
          size={100}
          x={0}
          y={0}
        />
      ) : (
        <StyledLoadingIndicator size={50} />
      )}
    </Header>
  );
}

export function WebVitalDescription({score, value, webVital}: Props) {
  const description: string = VITAL_DESCRIPTIONS[WebVital[webVital.toUpperCase()]];
  return (
    <div>
      <WebVitalDetailHeader score={score} value={value} webVital={webVital} />
      <p>{description}</p>
      <p>
        <b>
          {tct(
            `At the moment, there is support for [webVital] in the following browsers:`,
            {webVital: webVital.toUpperCase()}
          )}
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
  display: flex;
  align-items: center;
  font-weight: normal;
  margin-bottom: ${space(1)};
`;

const WebVitalName = styled('h4')`
  margin-bottom: ${space(1)};
  margin-top: 40px;
  max-width: 400px;
  ${p => p.theme.overflowEllipsis}
`;

const TitleWrapper = styled('div')`
  display: flex;
  align-items: baseline;
`;

const StyledCopyToClipboardButton = styled(CopyToClipboardButton)`
  padding-left: ${space(0.5)};
`;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  margin: 20px 65px;
`;

const ScoreBadge = styled('div')<{status: string}>`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  color: ${p => p.theme[PERFORMANCE_SCORE_COLORS[p.status].normal]};
  background-color: ${p => p.theme[PERFORMANCE_SCORE_COLORS[p.status].light]};
  border: solid 1px ${p => p.theme[PERFORMANCE_SCORE_COLORS[p.status].normal]};
  padding: ${space(0.5)};
  text-align: center;
  height: 60px;
  width: 60px;
  border-radius: 60px;
`;

const StatusText = styled('span')`
  padding-top: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeSmall};
`;

const StatusScore = styled('span')`
  font-weight: bold;
  font-size: ${p => p.theme.fontSizeLarge};
`;
