import type {ReactNode} from 'react';

import {ExternalLink} from '@sentry/scraps/link';
import {Tooltip} from '@sentry/scraps/tooltip';

import {tct} from 'sentry/locale';

const AI_PRIVACY_NOTICE_LINK =
  'https://docs.sentry.io/product/ai-in-sentry/ai-privacy-and-security/';

/**
 * This notice should be presented along with any AI-powered feature.
 */
export function AiPrivacyNotice() {
  return tct(
    'Powered by generative AI. Learn more about our [link:AI privacy principles].',
    {
      link: <ExternalLink href={AI_PRIVACY_NOTICE_LINK} />,
    }
  );
}

/**
 * A shortened version of the privacy noice, useful for tooltips or places where space is limited.
 */
function AiPrivacyNoticeShort() {
  return tct('Powered by genAI. [link:Learn more.]', {
    link: <ExternalLink href={AI_PRIVACY_NOTICE_LINK} />,
  });
}

/**
 * A tooltip wrapper for the privacy notice.
 */
export function AiPrivacyTooltip({children}: {children: ReactNode}) {
  return (
    <Tooltip isHoverable title={<AiPrivacyNoticeShort />}>
      {children}
    </Tooltip>
  );
}
