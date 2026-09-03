import type {ComponentType, ReactNode} from 'react';

import {ExternalLink, Link} from '@sentry/scraps/link';

import {
  IconChat,
  IconCode,
  IconCompass,
  IconDashboard,
  IconDocs,
  IconFire,
  IconIssues,
  IconList,
  IconPlay,
  IconProfiling,
  IconSiren,
  IconSpan,
  IconTable,
} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {isSafeHref} from 'sentry/utils/marked/marked';

/**
 * Every data type Seer surfaces as a resource link
 */
export type ResourceKind =
  | 'conversation'
  | 'log'
  | 'trace'
  | 'profiling'
  | 'span'
  | 'error'
  | 'issue'
  | 'query'
  | 'metrics'
  | 'monitor'
  | 'replay'
  | 'docs'
  | 'code'
  | 'dashboard';

export const RESOURCE_KIND_ICON: Record<ResourceKind, ComponentType<SVGIconProps>> = {
  conversation: IconChat,
  log: IconList,
  trace: IconSpan,
  profiling: IconProfiling,
  span: IconSpan,
  error: IconFire,
  issue: IconIssues,
  query: IconCompass,
  metrics: IconTable,
  monitor: IconSiren,
  replay: IconPlay,
  docs: IconDocs,
  code: IconCode,
  dashboard: IconDashboard,
};

export function ResourceLink({
  icon: Icon,
  href,
  title,
}: {
  icon: ComponentType<SVGIconProps>;
  title: string;
  /**
   * Omit when the resource has no page to link to. The title still renders, so
   * the reference stays readable instead of disappearing entirely.
   */
  href?: string;
}): ReactNode {
  const icon = <Icon size="xs" style={{verticalAlign: 'middle'}} />;

  if (!href) {
    return (
      <span>
        {icon} {title}
      </span>
    );
  }

  if (/^https?:\/\//.test(href) && isSafeHref(href)) {
    try {
      const parsed = new URL(href);
      if (parsed.origin !== window.location.origin) {
        return (
          <ExternalLink href={href}>
            {icon} {title}
          </ExternalLink>
        );
      }
      return (
        <Link to={parsed.pathname + parsed.search + parsed.hash}>
          {icon} {title}
        </Link>
      );
    } catch {
      return null;
    }
  }

  if (/^\/[^/]/.test(href)) {
    return (
      <Link to={href}>
        {icon} {title}
      </Link>
    );
  }

  return null;
}
