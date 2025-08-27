import {ExternalLink} from 'sentry/components/core/link';
import {t} from 'sentry/locale';
import {MODULE_PRODUCT_DOC_LINKS} from 'sentry/views/insights/settings';
import {ModuleName} from 'sentry/views/insights/types';

export const SPAN_HEADER_TOOLTIPS: Record<string, React.ReactNode> = {
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
      <ExternalLink
        href={`https://docs.sentry.io/product/insights/overview/metrics/#time-spent`}
      >
        {t('How is this calculated?')}
      </ExternalLink>
    </span>
  ),
};
