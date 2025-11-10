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

/**
 * This notice should be presented along with any AI-powered feature.
 */
export function AiPrivacyNotice({linkProps = {}}: AiPrivacyNoticeProps) {
  return tct(
    'Powered by generative AI. Learn more about our [link:AI privacy principles].',
    {
      link: (
        <ExternalLink
          href="https://docs.sentry.io/product/ai-in-sentry/ai-privacy-and-security/"
          {...linkProps}
        />
      ),
    }
  );
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
      title={<AiPrivacyNotice linkProps={linkProps} />}
      {...tooltipProps}
    >
      {children}
    </Tooltip>
  );
}
