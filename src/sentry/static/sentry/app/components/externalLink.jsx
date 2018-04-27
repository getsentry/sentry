import React from 'react';
import PropTypes from 'prop-types';
import 'app/../less/components/externalLink.less';

/**
 * Use this component when creating external links.
 *
 * By default will open in a new tab with `rel="noreferrer noopener"` to guard against
 * `target="_blank"` vulnerabilities
 */
export default function ExternalLink({href, ...otherProps}) {
  return <a {...otherProps} href={href} />;
}

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
