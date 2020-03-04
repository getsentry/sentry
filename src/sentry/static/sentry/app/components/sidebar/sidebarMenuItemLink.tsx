import React from 'react';

import Link from 'app/components/links/link';
import ExternalLink from 'app/components/links/externalLink';

export type SidebarMenuItemLinkProps = {
  /**
   * Use this prop if button is a react-router link
   */
  to?: string;
  /**
   * Use this prop if button should use a normal (non-react-router) link
   */
  href?: string;
  /**
   * Is an external link? (Will open in new tab; Only applicable if `href` is used)
   */
  external?: boolean;
  /**
   * specifies whether to open the linked document in a new tab
   */
  openInNewTab?: boolean;
  /**
   * It is raised when the user clicks on the element - optional
   */
  onClick?: () => void;
  /**
   * Inline styles
   */
  style?: React.CSSProperties;
};

const SidebarMenuItemLink = ({
  to,
  href,
  external,
  openInNewTab,
  ...props
}: SidebarMenuItemLinkProps) => {
  const target = openInNewTab ? '_blank' : '_self';

  if (to) {
    return <Link {...props} to={to} href={href} target={target} />;
  }

  if (href) {
    return external ? (
      // target is not passed here, as ExternalLink by default opens the link in a new tab
      <ExternalLink {...props} href={href} />
    ) : (
      <Link href={href} target={target} {...props} />
    );
  }

  return <div tabIndex={0} {...props} />;
};

export default SidebarMenuItemLink;
