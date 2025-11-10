import {ExternalLink} from '@sentry/scraps/link';

import {tct} from 'sentry/locale';

/**
 * This notice should be presented along with any AI-powered feature.
 * Usually this takes the form of a tooltip that is shown when the user hovers over the feature.
 */
export const AI_PRIVACY_NOTICE = tct(
  'Powered by generative AI. Learn more about our [link:AI privacy principles].',
  {
    link: (
      <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/ai-privacy-and-security/" />
    ),
  }
);
