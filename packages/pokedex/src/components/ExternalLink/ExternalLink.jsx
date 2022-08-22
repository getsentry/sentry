const ExternalLink = ({ target, href, children }) => (
  <a href={href} target={target ?? "_blank"} rel="noreferrer noopener">
    {children}
  </a>
);

export default ExternalLink;
