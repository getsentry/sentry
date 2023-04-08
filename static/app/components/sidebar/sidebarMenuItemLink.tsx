import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';

type Props = {
  // SidebarMenuItemLink content (accepted via string or components / DOM nodes)
  children: React.ReactNode;
  /**
   * Use this prop if button is an external link
   */
  href?: string;
  /**
   * It is raised when the user clicks on the element - optional
   */
  onClick?: () => void;
  /**
   * specifies whether to open the linked document in a new tab
   */
  openInNewTab?: boolean;
  /**
   * Inline styles
   */
  style?: React.CSSProperties;
  /**
   * Use this prop if button is a react-router link
   */
  to?: string;
};

function SidebarMenuItemLink({to, href, ...props}: Props) {
  if (href) {
    return <ExternalLink href={href} {...props} />;
  }

  if (to) {
    return <Link to={to} {...props} />;
  }

  return <div tabIndex={0} {...props} />;
}

export default SidebarMenuItemLink;
