import {useEffect, useState} from 'react';

import DetailedError from 'sentry/components/errors/detailedError';
import * as Layout from 'sentry/components/layouts/thirds';
import {t} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import {useParams} from 'sentry/utils/useParams';

type Props = RouteComponentProps;

/**
 * This component performs a client-side redirect to Event Details given only
 * an event ID (which normally additionally requires the event's Issue/Group ID).
 * It does this by using an XHR against the identically-named ProjectEventRedirect
 * _Django_ view, which responds with a 302 with the Location of the corresponding
 * Event Details page (if it exists).
 *
 * See:
 * https://github.com/getsentry/sentry/blob/824c03089907ad22a9282303a5eaca33989ce481/src/sentry/web/urls.py#L578
 */
function ProjectEventRedirect({router}: Props) {
  const [error, setError] = useState<string | null>(null);

  const params = useParams();

  useEffect(() => {
    // This presumes that _this_ React view/route is only reachable at
    // /:org/:project/events/:eventId (the same URL which serves the ProjectEventRedirect
    // Django view).
    const endpoint = `/organizations/${params.orgId}/projects/${params.projectId}/events/${params.eventId}/`;

    // Use XmlHttpRequest directly instead of our client API helper (fetch),
    // because you can't reach the underlying XHR via $.ajax, and we need
    // access to `xhr.responseURL`.
    //
    // TODO(epurkhiser): We can likely replace tihs with fetch
    const xhr = new XMLHttpRequest();

    // Hitting this endpoint will return a 302 with a new location, which
    // the XHR will follow and make a _second_ request. Using HEAD instead
    // of GET returns an empty response instead of the entire HTML content.
    xhr.open('HEAD', endpoint);
    xhr.send();

    xhr.onload = () => {
      if (xhr.status === 404) {
        setError(t('Could not find an issue for the provided event id'));
        return;
      }
      // responseURL is the URL of the document the browser ultimately loaded,
      // after following any redirects. It _should_ be the page we're trying
      // to reach; use the router to go there.
      //
      // Use `replace` so that hitting the browser back button will skip all
      // this redirect business.
      const url = new URL(xhr.responseURL);
      if (url.origin === window.location.origin) {
        router.replace(url.pathname);
      } else {
        // If the origin has changed, we cannot do a simple replace with the router.
        // Instead, we opt to do a full redirect.
        window.location.replace(xhr.responseURL);
      }
    };
    xhr.onerror = () => {
      setError(t('Could not load the requested event'));
    };
  }, [params, router]);

  return error ? (
    <DetailedError heading={t('Not found')} message={error} hideSupportLinks />
  ) : (
    <Layout.Page withPadding />
  );
}

export default ProjectEventRedirect;
