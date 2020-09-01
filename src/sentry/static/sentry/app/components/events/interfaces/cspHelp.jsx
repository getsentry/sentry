import PropTypes from 'prop-types';
import React from 'react';

import {t} from 'app/locale';
import {IconOpen} from 'app/icons';
import ExternalLink from 'app/components/links/externalLink';

const help = {
  'base-uri': t(
    `The <code>base-uri</code> directive defines the URIs that a user agent
may use as the document base URL. If this value is absent, then any URI
is allowed. If this directive is absent, the user agent will use the
value in the <code>&lt;base&gt;</code> element.`
  ),
  'child-src': t(
    `The <code>child-src</code> directive defines the valid sources for
web workers and nested browsing contexts loaded using elements such as
<code>&lt;frame&gt;</code> and <code>&lt;iframe&gt;</code>.`
  ),
  'connect-src': t(
    `The <code>connect-src</code> directive defines valid sources for fetch,
<code>XMLHttpRequest</code>, <code>WebSocket</code>, and
<code>EventSource</code> connections.`
  ),
  'font-src': t(
    `The <code>font-src</code> directive specifies valid sources for fonts
loaded using <code>@font-face</code>.`
  ),
  'form-action': t(
    `The <code>form-action</code> directive specifies valid endpoints for
<code>&lt;form&gt;</code> submissions.`
  ),
  'frame-ancestors': t(
    `The <code>frame-ancestors</code> directive specifies valid parents that
may embed a page using the <code>&lt;frame&gt;</code> and
<code>&lt;iframe&gt;</code> elements.`
  ),
  'img-src': t(
    `The <code>img-src</code> directive specifies valid sources of images and
favicons.`
  ),
  'prefetch-src': t(
    `The <code>prefetch-src</code> directive restricts the URLs
    from which resources may be prefetched or prerendered.`
  ),
  'manifest-src': t(
    `The <code>manifest-src</code> directive specifies which manifest can be
applied to the resource.`
  ),
  'media-src': t(
    `The <code>media-src</code> directive specifies valid sources for loading
media using the <code>&lt;audio&gt;</code> and <code>&lt;video&gt;</code>
elements.`
  ),
  'object-src': t(
    `The <code>object-src</code> directive specifies valid sources for the
<code>&lt;object&gt;</code>, <code>&lt;embed&gt;</code>, and
<code>&lt;applet&gt;</code> elements.`
  ),
  'plugin-types': t(
    `The <code>plugin-types</code> directive specifies the valid plugins that
the user agent may invoke.`
  ),
  referrer: t(
    `The <code>referrer</code> directive specifies information in the
<code>Referer</code> header for links away from a page.`
  ),
  'script-src': t(
    `The <code>script-src</code> directive specifies valid sources
for JavaScript. When either the <code>script-src</code> or the
<code>default-src</code> directive is included, inline script and
<code>eval()</code> are disabled unless you specify 'unsafe-inline'
and 'unsafe-eval', respectively.`
  ),
  'script-src-elem': t(
    `The <code>script-src-elem</code> directive applies to all script requests
    and element contents. It does not apply to scripts defined in attributes.`
  ),
  'script-src-attr': t(
    `The <code>script-src-attr</code> directive applies to event handlers and, if present,
    it will override the <code>script-src</code> directive for relevant checks.`
  ),
  'style-src': t(
    `The <code>style-src</code> directive specifies valid sources for
stylesheets. This includes both externally-loaded stylesheets and inline
use of the <code>&lt;style&gt;</code> element and HTML style attributes.
Stylesheets from sources that aren't included in the source list are not
requested or loaded. When either the <code>style-src</code> or the
<code>default-src</code> directive is included, inline use of the
<code>&lt;style&gt;</code> element and HTML style attributes are disabled
unless you specify 'unsafe-inline'.`
  ),
  'style-src-elem': t(
    `The <code>style-src-elem</code> directive applies to all styles except
    those defined in inline attributes.`
  ),
  'style-src-attr': t(
    `The <code>style-src-attr</code> directive applies to inline style attributes and, if present,
    it will override the <code>style-src</code> directive for relevant checks.`
  ),
  'frame-src': t(
    `The <code>frame-src</code> directive specifies valid sources for nested
browsing contexts loading using elements such as
<code>&lt;frame&gt;</code> and <code>&lt;iframe&gt;</code>.`
  ),
  'worker-src': t(
    `The <code>worker-src</code> directive specifies valid sources for
<code>Worker<code>, <code>SharedWorker</code>, or
<code>ServiceWorker</code> scripts.`
  ),
};

const linkOverrides = {
  'script-src': 'script-src_2',
};

function getHelp(key) {
  return {
    __html: help[key],
  };
}

function getLinkHref(key) {
  let link = key;
  if (key in linkOverrides) {
    link = linkOverrides[key];
  }
  return `https://developer.mozilla.org/en-US/docs/Web/Security/CSP/CSP_policy_directives#${link}`;
}

function getLink(key) {
  const href = getLinkHref(key);

  return (
    <span>
      <ExternalLink href={href}>developer.mozilla.org</ExternalLink>
      <ExternalLink href={href} className="external-icon">
        <IconOpen size="xs" />
      </ExternalLink>
    </span>
  );
}

class CSPHelp extends React.Component {
  static propTypes = {
    data: PropTypes.object.isRequired,
  };

  render() {
    const {data} = this.props;
    const key = data.effective_directive;
    return (
      <div>
        <h4>
          <code>{key}</code>
        </h4>
        <blockquote dangerouslySetInnerHTML={getHelp(key)} />
        <p style={{textAlign: 'right'}}>— MDN ({getLink(key)})</p>
      </div>
    );
  }
}

export default CSPHelp;
