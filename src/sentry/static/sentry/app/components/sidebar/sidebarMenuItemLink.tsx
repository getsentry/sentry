import * as React from 'react';

import Link from 'app/components/links/link';
import ExternalLink from 'app/components/links/externalLink';

type Props = {
  // SidebarMenuItemLink content (accepted via string or components / DOM nodes)
  children: React.ReactNode;
  /**
   * Use this prop if button is a react-router link
   */
  to?: string;
  /**
   * Use this prop if button is an external link
   */
  href?: string;
  /**
   * It is raised when the user clicks on the element - optional
   */
  onClick?: () => void;
  /**
   * Inline styles
   */
  style?: React.CSSProperties;
  /**
   * specifies whether to open the linked document in a new tab
   */
  openInNewTab?: boolean;
};

const SidebarMenuItemLink = ({to, href, ...props}: Props) => {
  if (href) {
    return <ExternalLink href={href} {...props} />;
  }

  if (to) {
    return <Link to={to} {...props} />;
  }

  return <div tabIndex={0} {...props} />;
};

export default SidebarMenuItemLink;
