import * as React from 'react';

type AnchorProps = React.HTMLProps<HTMLAnchorElement>;

type Props = {
  className?: string;
  openInNewTab?: boolean;
} & Omit<AnchorProps, 'target'>;

const ExternalLink = React.forwardRef<HTMLAnchorElement, Props>(function ExternalLink(
  {openInNewTab = true, ...props},
  ref
) {
  const anchorProps = openInNewTab ? {target: '_blank', rel: 'noreferrer noopener'} : {};
  return <a ref={ref} {...anchorProps} {...props} />;
});

export default ExternalLink;
