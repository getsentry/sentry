import Anchor from './anchor';

export interface ExternalLinkProps
  extends Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'target'> {
  disabled?: boolean;
  openInNewTab?: boolean;
}

function ExternalLink({
  ref,
  openInNewTab = true,
  ...props
}: ExternalLinkProps & {
  ref?: React.Ref<HTMLAnchorElement>;
}) {
  const anchorProps = openInNewTab
    ? {target: '_blank', rel: 'noreferrer noopener'}
    : {href: props.href};

  return <Anchor ref={ref} {...anchorProps} {...props} />;
}

export default ExternalLink;
