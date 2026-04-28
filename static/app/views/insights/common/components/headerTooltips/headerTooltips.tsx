import {ExternalLink} from '@sentry/scraps/link';

import {t} from 'sentry/locale';
import {MODULE_PRODUCT_DOC_LINKS} from 'sentry/views/insights/settings';
import {ModuleName} from 'sentry/views/insights/types';

export const SPAN_HEADER_TOOLTIPS: Record<string, React.ReactNode> = {
  p50: (
    <span>
      {t('P50 Threshold')}
      <br />
      <ExternalLink href="https://docs.sentry.io/product/insights/overview/metrics/#p50-threshold">
        {t('Read more')}
      </ExternalLink>
    </span>
  ),
  p75: (
    <span>
      {t('P75 Threshold')}
      <br />
      <ExternalLink href="https://docs.sentry.io/product/insights/overview/metrics/#p75-threshold">
        {t('Read more')}
      </ExternalLink>
    </span>
  ),
  p95: (
    <span>
      {t('P95 Threshold')}
      <br />
      <ExternalLink href="https://docs.sentry.io/product/insights/overview/metrics/#p95-threshold">
        {t('Read more')}
      </ExternalLink>
    </span>
  ),
  failureRate: (
    <span>
      {t('Percentage of unsuccessful transactions')}
      <br />
      <ExternalLink href="https://docs.sentry.io/product/insights/overview/metrics/#failure-rate">
        {t('How is this calculated?')}
      </ExternalLink>
    </span>
  ),
  tpm: (
    <span>
      {t('Transaction Per Minute (TPM)')}
      <br />
      <ExternalLink href="https://docs.sentry.io/product/insights/overview/metrics/#throughput-total-tpm-tps">
        {t('Read more')}
      </ExternalLink>
    </span>
  ),
  performanceScore: (
    <span>
      {t('The overall performance rating of this page.')}
      <br />
      <ExternalLink
        href={`${MODULE_PRODUCT_DOC_LINKS[ModuleName.VITAL]}#performance-score`}
      >
        {t('How is this calculated?')}
      </ExternalLink>
    </span>
  ),
  timeSpent: (
    <span>
      {t('The total time spent on this span.')}
      <br />
      <ExternalLink href="https://docs.sentry.io/product/insights/overview/metrics/#time-spent">
        {t('How is this calculated?')}
      </ExternalLink>
    </span>
  ),
};
