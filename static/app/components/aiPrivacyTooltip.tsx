import type {ReactNode} from 'react';

import {ExternalLink} from '@sentry/scraps/link/link';

import {Tooltip, type TooltipProps} from 'sentry/components/core/tooltip';
import {tct} from 'sentry/locale';

interface AiPrivacyTooltipProps extends Omit<TooltipProps, 'title' | 'children'> {
  children: ReactNode;
}

/**
 * A tooltip wrapper that links to AI privacy and security documentation.
 */
export function AiPrivacyTooltip({children, ...tooltipProps}: AiPrivacyTooltipProps) {
  return (
    <Tooltip
      isHoverable
      title={tct(`[link:Learn more]`, {
        link: (
          <ExternalLink href="https://docs.sentry.io/product/ai-in-sentry/ai-privacy-and-security/" />
        ),
      })}
      {...tooltipProps}
    >
      {children}
    </Tooltip>
  );
}
