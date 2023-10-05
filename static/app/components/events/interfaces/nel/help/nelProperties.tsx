import {t} from 'sentry/locale';

const nelProperties = {
  referrer: t(
    `Request's referrer, as determined by the referrer policy associated with its client.`
  ),
  sampling_fraction: t(`sampling rate`),
  server_ip: t(
    `The IP address of the server to which the user agent sent the request, if available. Otherwise, an empty string.`
  ),
  protocol: t(
    `The network protocol used to fetch the resource as identified by the ALPN Protocol ID, if available. Otherwise, "".`
  ),
  method: t(`request's request method.`),
  request_headers: t(
    `The result of executing <a href="https://w3c.github.io/network-error-logging/#extract-request-headers" target="_blank" rel="noreferrer">5.2 Extract request headers</a> on <em>request</em> and <em>policy</em>.`
  ),
  response_headers: t(
    `The result of executing <a href="https://w3c.github.io/network-error-logging/#extract-response-headers" target="_blank" rel="noreferrer">5.3 Extract response headers</a> on <em>response</em> and <em>policy</em>.`
  ),
  status_code: t(
    `The status code of the HTTP response, if available. Otherwise, <code>0</code>.`
  ),
  elapsed_time: t(
    `The elapsed number of milliseconds between the start of the resource fetch and when it was completed or aborted by the user agent.`
  ),
  phase: t(
    `If request failed, the phase of its network error. If request succeeded, "application".`
  ),
  type: t(
    `If request failed, the type of its network error. If request succeeded, "ok".`
  ),
};

export default nelProperties;
