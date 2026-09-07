import {tctCode} from 'sentry/locale';

export const effectiveDirectives = {
  'base-uri': tctCode(
    `The [code:base-uri] directive defines the URIs that a user agent
  may use as the document base URL. If this value is absent, then any URI
  is allowed. If this directive is absent, the user agent will use the
  value in the [code:<base>] element.`
  ),
  'child-src': tctCode(
    `The [code:child-src] directive defines the valid sources for
  web workers and nested browsing contexts loaded using elements such as
  [code:<frame>] and [code:<iframe>].`
  ),
  'connect-src': tctCode(
    `The [code:connect-src] directive defines valid sources for fetch,
  [code:XMLHttpRequest], [code:WebSocket], and
  [code:EventSource] connections.`
  ),
  'font-src': tctCode(
    `The [code:font-src] directive specifies valid sources for fonts
  loaded using [code:@font-face].`
  ),
  'form-action': tctCode(
    `The [code:form-action] directive specifies valid endpoints for
  [code:<form>] submissions.`
  ),
  'frame-ancestors': tctCode(
    `The [code:frame-ancestors] directive specifies valid parents that
  may embed a page using the [code:<frame>] and
  [code:<iframe>] elements.`
  ),
  'img-src': tctCode(
    `The [code:img-src] directive specifies valid sources of images and
  favicons.`
  ),
  'prefetch-src': tctCode(
    `The [code:prefetch-src] directive restricts the URLs
      from which resources may be prefetched or prerendered.`
  ),
  'manifest-src': tctCode(
    `The [code:manifest-src] directive specifies which manifest can be
  applied to the resource.`
  ),
  'media-src': tctCode(
    `The [code:media-src] directive specifies valid sources for loading
  media using the [code:<audio>] and [code:<video>]
  elements.`
  ),
  'object-src': tctCode(
    `The [code:object-src] directive specifies valid sources for the
  [code:<object>], [code:<embed>], and
  [code:<applet>] elements.`
  ),
  'plugin-types': tctCode(
    `The [code:plugin-types] directive specifies the valid plugins that
  the user agent may invoke.`
  ),
  referrer: tctCode(
    `The [code:referrer] directive specifies information in the
  [code:Referer] header for links away from a page.`
  ),
  'script-src': tctCode(
    `The [code:script-src] directive specifies valid sources
  for JavaScript. When either the [code:script-src] or the
  [code:default-src] directive is included, inline script and
  [code:eval()] are disabled unless you specify 'unsafe-inline'
  and 'unsafe-eval', respectively.`
  ),
  'script-src-elem': tctCode(
    `The [code:script-src-elem] directive applies to all script requests
      and element contents. It does not apply to scripts defined in attributes.`
  ),
  'script-src-attr': tctCode(
    `The [code:script-src-attr] directive applies to event handlers and, if present,
      it will override the [code:script-src] directive for relevant checks.`
  ),
  'style-src': tctCode(
    `The [code:style-src] directive specifies valid sources for
  stylesheets. This includes both externally-loaded stylesheets and inline
  use of the [code:<style>] element and HTML style attributes.
  Stylesheets from sources that aren't included in the source list are not
  requested or loaded. When either the [code:style-src] or the
  [code:default-src] directive is included, inline use of the
  [code:<style>] element and HTML style attributes are disabled
  unless you specify 'unsafe-inline'.`
  ),
  'style-src-elem': tctCode(
    `The [code:style-src-elem] directive applies to all styles except
      those defined in inline attributes.`
  ),
  'style-src-attr': tctCode(
    `The [code:style-src-attr] directive applies to inline style attributes and, if present,
      it will override the [code:style-src] directive for relevant checks.`
  ),
  'frame-src': tctCode(
    `The [code:frame-src] directive specifies valid sources for nested
  browsing contexts loading using elements such as
  [code:<frame>] and [code:<iframe>].`
  ),
  'worker-src': tctCode(
    `The [code:worker-src] directive specifies valid sources for
  [code:Worker], [code:SharedWorker], or
  [code:ServiceWorker] scripts.`
  ),
};
