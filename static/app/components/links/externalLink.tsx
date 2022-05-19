import {forwardRef} from 'react';

import Anchor from './anchor';

export interface ExternalLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'target'> {
  disabled?: boolean;
  openInNewTab?: boolean;
}

const ExternalLink = forwardRef<HTMLAnchorElement, ExternalLinkProps>(
  ({openInNewTab = true, ...props}, ref) => {
    const anchorProps = openInNewTab
      ? {target: '_blank', rel: 'noreferrer noopener'}
      : {href: props.href};

    return <Anchor ref={ref} {...anchorProps} {...props} />;
  }
);

export default ExternalLink;
