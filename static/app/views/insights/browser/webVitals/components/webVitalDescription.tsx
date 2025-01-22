import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import ExternalLink from 'sentry/components/links/externalLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {COUNTRY_CODE_TO_NAME_MAP} from 'sentry/data/countryCodesMap';
import {IconCheckmark} from 'sentry/icons/iconCheckmark';
import {IconClose} from 'sentry/icons/iconClose';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Tag} from 'sentry/types/group';
import {WebVital} from 'sentry/utils/fields';
import {Browser} from 'sentry/utils/performance/vitals/constants';
import {ORDER} from 'sentry/views/insights/browser/webVitals/components/charts/performanceScoreChart';
import {Dot} from 'sentry/views/insights/browser/webVitals/components/webVitalMeters';
import type {
  ProjectScore,
  WebVitals,
} from 'sentry/views/insights/browser/webVitals/types';
import {PERFORMANCE_SCORE_COLORS} from 'sentry/views/insights/browser/webVitals/utils/performanceScoreColors';
import {
  scoreToStatus,
  STATUS_TEXT,
} from 'sentry/views/insights/browser/webVitals/utils/scoreToStatus';
import {vitalSupportedBrowsers} from 'sentry/views/performance/vitalDetail/utils';

import PerformanceScoreRingWithTooltips from './performanceScoreRingWithTooltips';

type Props = {
  webVital: WebVitals;
  score?: number;
  value?: string;
};

const WEB_VITAL_FULL_NAME_MAP = {
  cls: t('Cumulative Layout Shift'),
  fcp: t('First Contentful Paint'),
  inp: t('Interaction to Next Paint'),
  lcp: t('Largest Contentful Paint'),
  ttfb: t('Time to First Byte'),
};

export const VITAL_DESCRIPTIONS: Partial<
  Record<
    WebVital,
    {longDescription: string; shortDescription: string; link?: React.ReactNode}
  >
> = {
  [WebVital.FCP]: {
    shortDescription: t(
      'Time for first DOM content to render. Bad FCP makes users feel like the page isn’t responding or loading.'
    ),
    longDescription: t(
      'First Contentful Paint (FCP) measures the amount of time the first content takes to render in the viewport. Like FP, this could also show up in any form from the document object model (DOM), such as images, SVGs, or text blocks.'
    ),
    link: (
      <ExternalLink
        openInNewTab
        href="https://blog.sentry.io/how-to-make-your-web-page-faster-before-it-even-loads/"
      >
        How can I fix my FCP?
      </ExternalLink>
    ),
  },
  [WebVital.CLS]: {
    shortDescription: t(
      'Measures content ‘shifting’ during load. Bad CLS indicates a janky website, degrading UX and trust.'
    ),
    longDescription: t(
      'Cumulative Layout Shift (CLS) is the sum of individual layout shift scores for every unexpected element shift during the rendering process. Imagine navigating to an article and trying to click a link before the page finishes loading. Before your cursor even gets there, the link may have shifted down due to an image rendering. Rather than using duration for this Web Vital, the CLS score represents the degree of disruptive and visually unstable shifts.'
    ),
    link: (
      <ExternalLink
        openInNewTab
        href="https://blog.sentry.io/from-lcp-to-cls-improve-your-core-web-vitals-with-image-loading-best/"
      >
        How can I fix my CLS?
      </ExternalLink>
    ),
  },
  [WebVital.LCP]: {
    shortDescription: t(
      'Time to render the largest item in the viewport. Bad LCP frustrates users because the website feels slow to load.'
    ),
    longDescription: t(
      'Largest Contentful Paint (LCP) measures the render time for the largest content to appear in the viewport. This may be in any form from the document object model (DOM), such as images, SVGs, or text blocks. It’s the largest pixel area in the viewport, thus most visually defining. LCP helps developers understand how long it takes to see the main content on the page.'
    ),
    link: (
      <ExternalLink
        openInNewTab
        href="https://blog.sentry.io/from-lcp-to-cls-improve-your-core-web-vitals-with-image-loading-best/"
      >
        How can I fix my LCP?
      </ExternalLink>
    ),
  },
  [WebVital.TTFB]: {
    shortDescription: t(
      'Time until first byte is delivered to the client. Bad TTFB makes the server feel unresponsive.'
    ),
    longDescription: t(
      'Time to First Byte (TTFB) is a foundational metric for measuring connection setup time and web server responsiveness in both the lab and the field. It helps identify when a web server is too slow to respond to requests. In the case of navigation requests—that is, requests for an HTML document—it precedes every other meaningful loading performance metric.'
    ),
    link: (
      <ExternalLink
        openInNewTab
        href="https://blog.sentry.io/how-i-fixed-my-brutal-ttfb/"
      >
        How can I fix my TTFB?
      </ExternalLink>
    ),
  },
  [WebVital.INP]: {
    shortDescription: t(
      'Latency between user input and visual response. Bad INP makes users feel like the site is laggy, outdated, and unresponsive. '
    ),
    longDescription: t(
      "Interaction to Next Paint (INP) is a metric that assesses a page's overall responsiveness to user interactions by observing the latency of all click, tap, and keyboard interactions that occur throughout the lifespan of a user's visit to a page. The final INP value is the longest interaction observed, ignoring outliers."
    ),
    link: (
      <ExternalLink openInNewTab href="https://blog.sentry.io/what-is-inp/">
        How can I fix my INP?
      </ExternalLink>
    ),
  },
};

type WebVitalDetailHeaderProps = {
  isProjectScoreCalculated: boolean;
  projectScore: ProjectScore;
  tag: Tag;
  value: React.ReactNode;
};

export function WebVitalDetailHeader({score, value, webVital}: Props) {
  const theme = useTheme();
  const colors = theme.charts.getColorPalette(3) ?? [];
  const dotColor = colors[ORDER.indexOf(webVital)]!;
  const status = score !== undefined ? scoreToStatus(score) : undefined;

  return (
    <Header>
      <span>
        <WebVitalName>{`${WEB_VITAL_FULL_NAME_MAP[webVital]} (P75)`}</WebVitalName>
        <Value>
          <Dot color={dotColor} />
          {value ?? ' \u2014 '}
        </Value>
      </span>
      {status && score && (
        <ScoreBadge status={status}>
          <StatusText>{STATUS_TEXT[status]}</StatusText>
          <StatusScore>{score}</StatusScore>
        </ScoreBadge>
      )}
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
  const ringSegmentColors = theme.charts.getColorPalette(3) ?? [];
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
  // @ts-ignore TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const {longDescription, link} = VITAL_DESCRIPTIONS[WebVital[webVital.toUpperCase()]];

  return (
    <div>
      <WebVitalDetailHeader score={score} value={value} webVital={webVital} />
      <DescriptionWrapper>
        {longDescription}
        {link}
      </DescriptionWrapper>

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
            {vitalSupportedBrowsers[
              WebVital[webVital.toUpperCase() as Uppercase<typeof webVital>]
            ]?.includes(browser) ? (
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

const DescriptionWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  margin-bottom: ${space(2)};
`;

const Value = styled('h2')`
  display: flex;
  align-items: center;
  font-weight: ${p => p.theme.fontWeightNormal};
  margin-bottom: ${space(1)};
`;

const WebVitalName = styled('h4')`
  margin-bottom: ${space(1)};
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

const ScoreBadge = styled('div')<{status: keyof typeof PERFORMANCE_SCORE_COLORS}>`
  display: flex;
  justify-content: center;
  align-items: center;
  flex-direction: column;
  color: ${p => p.theme[PERFORMANCE_SCORE_COLORS[p.status].normal]};
  background-color: ${p => p.theme[PERFORMANCE_SCORE_COLORS[p.status].light]};
  border: solid 1px ${p => p.theme[PERFORMANCE_SCORE_COLORS[p.status].light]};
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
  font-weight: ${p => p.theme.fontWeightBold};
  font-size: ${p => p.theme.fontSizeLarge};
`;
