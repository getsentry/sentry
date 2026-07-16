import type {ComponentType, ReactNode} from 'react';

import {ExternalLink, Link} from '@sentry/scraps/link';

import type {SVGIconProps} from 'sentry/icons/svgIcon';

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

  if (/^https?:\/\//.test(href)) {
    try {
      if (new URL(href).origin !== window.location.origin) {
        return (
          <ExternalLink href={href}>
            {icon} {title}
          </ExternalLink>
        );
      }
    } catch {
      /* noop */
    }
  }

  return (
    <Link to={href}>
      {icon} {title}
    </Link>
  );
}
