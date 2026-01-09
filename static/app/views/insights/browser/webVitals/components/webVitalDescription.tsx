import styled from '@emotion/styled';

import {Flex, Stack} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {IconCheckmark} from 'sentry/icons/iconCheckmark';
import {IconClose} from 'sentry/icons/iconClose';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {WebVital} from 'sentry/utils/fields';
import {Browser} from 'sentry/utils/performance/vitals/constants';
import {PerformanceBadge} from 'sentry/views/insights/browser/webVitals/components/performanceBadge';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import {scoreToStatus} from 'sentry/views/insights/browser/webVitals/utils/scoreToStatus';
import {vitalSupportedBrowsers} from 'sentry/views/performance/vitalDetail/utils';

type Props = {
  webVital: WebVitals;
  score?: number;
  value?: string;
};

export const WEB_VITAL_FULL_NAME_MAP = {
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
        How do I fix my FCP?
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
        How do I fix my CLS score?
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
        How do I fix my LCP score?
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
        How do I fix my TTFB score?
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
        How do I fix my INP score?
      </ExternalLink>
    ),
  },
};

export function WebVitalDetailHeader({score, value, webVital}: Props) {
  const status = score === undefined ? undefined : scoreToStatus(score);

  return (
    <Flex justify="between">
      <div>
        <WebVitalName>{`${WEB_VITAL_FULL_NAME_MAP[webVital]} (P75)`}</WebVitalName>
        <WebVitalScore>
          <Value>{value ?? ' \u2014 '}</Value>
          {status && score && <PerformanceBadge score={score} />}
        </WebVitalScore>
      </div>
    </Flex>
  );
}

export function WebVitalDescription({score, value, webVital}: Props) {
  // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
  const {longDescription, link} = VITAL_DESCRIPTIONS[WebVital[webVital.toUpperCase()]];

  return (
    <div>
      <WebVitalDetailHeader score={score} value={value} webVital={webVital} />
      <Stack marginBottom="md">
        {longDescription}
        {tct(` [webVital] is available for the following browsers:`, {
          webVital: webVital.toUpperCase(),
        })}
      </Stack>
      <SupportedBrowsers>
        {Object.values(Browser).map(browser => (
          <Flex align="center" gap="md" key={browser}>
            {vitalSupportedBrowsers[
              WebVital[webVital.toUpperCase() as Uppercase<typeof webVital>]
            ]?.includes(browser) ? (
              <IconCheckmark variant="success" size="sm" />
            ) : (
              <IconClose variant="danger" size="sm" />
            )}
            {browser}
          </Flex>
        ))}
      </SupportedBrowsers>
      <ReferenceLink>{link}</ReferenceLink>
    </div>
  );
}

const SupportedBrowsers = styled('div')`
  display: inline-flex;
  gap: ${space(2)};
  margin-bottom: ${space(2)};
`;

const ReferenceLink = styled('div')`
  margin-bottom: ${space(2)};
`;

const Value = styled('h2')`
  margin-bottom: 0;
`;

const WebVitalName = styled('h6')`
  margin-bottom: 0;
  ${p => p.theme.overflowEllipsis}
`;

const WebVitalScore = styled('div')`
  display: flex;
  align-items: anchor-center;
  font-weight: ${p => p.theme.fontWeight.bold};
  margin-bottom: ${space(1)};
  gap: ${space(1)};
`;
