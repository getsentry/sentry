import type {ComponentProps, ReactNode} from 'react';

import {ExternalLink} from '@sentry/scraps/link/link';

import {Tooltip, type TooltipProps} from 'sentry/components/core/tooltip';
import {tct} from 'sentry/locale';

interface AiPrivacyNoticeProps {
  linkProps?: Partial<ComponentProps<typeof ExternalLink>>;
}

interface AiPrivacyTooltipProps
  extends Omit<TooltipProps, 'title' | 'children'>,
    AiPrivacyNoticeProps {
  children: ReactNode;
}

const AI_PRIVACY_NOTICE_LINK =
  'https://docs.sentry.io/product/ai-in-sentry/ai-privacy-and-security/';

/**
 * This notice should be presented along with any AI-powered feature.
 */
export function AiPrivacyNotice({linkProps = {}}: AiPrivacyNoticeProps) {
  return tct(
    'Powered by generative AI. Learn more about our [link:AI privacy principles].',
    {
      link: <ExternalLink href={AI_PRIVACY_NOTICE_LINK} {...linkProps} />,
    }
  );
}

/**
 * A shortened version of the privacy noice, useful for tooltips or places where space is limited.
 */
function AiPrivacyNoticeShort({linkProps = {}}: AiPrivacyNoticeProps) {
  return tct(`Powered by genAI. [link:Learn more.]`, {
    link: <ExternalLink href={AI_PRIVACY_NOTICE_LINK} {...linkProps} />,
  });
}

/**
 * A tooltip wrapper for the privacy notice.
 */
export function AiPrivacyTooltip({
  children,
  linkProps,
  ...tooltipProps
}: AiPrivacyTooltipProps) {
  return (
    <Tooltip
      isHoverable
      title={<AiPrivacyNoticeShort linkProps={linkProps} />}
      {...tooltipProps}
    >
      {children}
    </Tooltip>
  );
}
