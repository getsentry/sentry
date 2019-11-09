import React from 'react';

type AnchorProps = React.HTMLProps<HTMLAnchorElement>;
type Props = AnchorProps & Required<Pick<AnchorProps, 'href'>>;

export default React.forwardRef<HTMLAnchorElement, Props>((props, ref) => (
  <a ref={ref} target="_blank" rel="noreferrer noopener" {...props} />
));
