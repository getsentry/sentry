import React from 'react';
import PropTypes from 'prop-types';

type AnchorProps = React.HTMLProps<HTMLAnchorElement>;
type Props = AnchorProps & Required<Pick<AnchorProps, 'href'>>;

// TODO(ts): React types gets the return of forwardRef a bit wrong [1] and does
// not include propTypes as an allowed attribute. Add propTypes in here.
//
// [1]: https://github.com/DefinitelyTyped/DefinitelyTyped/issues/37660
type ForwardRefWithProps<T, P> = React.ForwardRefExoticComponent<
  React.PropsWithoutRef<P> & React.RefAttributes<T>
> & {propTypes?: React.WeakValidationMap<P>};

/**
 * Use this component when creating external links.
 *
 * By default will open in a new tab with `rel="noreferrer noopener"` to guard
 * against `target="_blank"` vulnerabilities
 */
const ExternalLink = React.forwardRef<HTMLAnchorElement, Props>((props, ref) => (
  <a ref={ref} {...props} />
)) as ForwardRefWithProps<HTMLAnchorElement, Props>;

ExternalLink.propTypes = {
  href: PropTypes.string.isRequired,
  target: PropTypes.string,
  rel: PropTypes.string,
};

// Should we allow these to be overridden?
ExternalLink.defaultProps = {
  target: '_blank',
  rel: 'noreferrer noopener',
};

export default ExternalLink;
