import type {ComponentType, ReactNode} from 'react';

import {ExternalLink, Link} from '@sentry/scraps/link';

import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {isSafeHref} from 'sentry/utils/marked/marked';

export function ResourceLink({
  icon: Icon,
  href,
  title,
}: {
  href: string;
  icon: ComponentType<SVGIconProps>;
  title: string;
}): ReactNode {
  const icon = <Icon size="xs" style={{verticalAlign: 'middle'}} />;

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
