import {Anchor} from 'sentry/components/core/link';

interface ExternalLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'target'> {
  disabled?: boolean;
  openInNewTab?: boolean;
  ref?: React.Ref<HTMLAnchorElement>;
}

function ExternalLink({ref, openInNewTab = true, ...props}: ExternalLinkProps) {
  const anchorProps = openInNewTab
    ? {target: '_blank', rel: 'noreferrer noopener'}
    : {href: props.href};

  return <Anchor ref={ref} {...anchorProps} {...props} />;
}

export default ExternalLink;
