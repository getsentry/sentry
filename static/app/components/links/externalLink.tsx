import * as React from 'react';

export interface ExternalLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'target'> {
  disabled?: boolean;
  openInNewTab?: boolean;
}

const ExternalLink = React.forwardRef<HTMLAnchorElement, ExternalLinkProps>(
  ({openInNewTab = true, ...props}, ref) => {
    const anchorProps = openInNewTab
      ? {target: '_blank', rel: 'noreferrer noopener'}
      : {href: props.href};

    return <a ref={ref} {...anchorProps} {...props} />;
  }
);

export default ExternalLink;
