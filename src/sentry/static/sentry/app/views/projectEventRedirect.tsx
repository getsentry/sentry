import PropTypes from 'prop-types';
import React from 'react';
import {RouteComponentProps} from 'react-router/lib/Router';

import {PageContent} from 'app/styles/organization';
import {t} from 'app/locale';
import DetailedError from 'app/components/errors/detailedError';

type Props = RouteComponentProps<{}, {}>;

type State = {
  error: string | null;
};

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
class ProjectEventRedirect extends React.Component<Props, State> {
  static propTypes = {
    router: PropTypes.object,
  };

  state: State = {
    error: null,
  };

  componentDidMount() {
    const {router} = this.props;

    // This presumes that _this_ React view/route is only reachable at
    // /:org/:project/events/:eventId (the same URL which serves the ProjectEventRedirect
    // Django view).
    const endpoint = router.location.pathname;

    // Use XmlHttpRequest directly instead of our client API helper (jQuery),
    // because you can't reach the underlying XHR via $.ajax, and we need
    // access to `xhr.responseURL`.
    const xhr = new XMLHttpRequest();

    // Hitting this endpoint will return a 302 with a new location, which
    // the XHR will follow and make a _second_ request. Using HEAD instead
    // of GET returns an empty response instead of the entire HTML content.
    xhr.open('HEAD', endpoint);
    xhr.send();

    xhr.onload = () => {
      if (xhr.status === 404) {
        this.setState({error: t('Could not find an issue for the provided event id')});
        return;
      }
      // responseURL is the URL of the document the browser ultimately loaded,
      // after following any redirects. It _should_ be the page we're trying
      // to reach; use the router to go there.

      // Use `replace` so that hitting the browser back button will skip all
      // this redirect business.
      router.replace(xhr.responseURL);
    };
    xhr.onerror = () => {
      this.setState({error: t('Could not load the requested event')});
    };
  }

  render() {
    return this.state.error ? (
      <DetailedError
        heading={t('Not found')}
        message={this.state.error}
        hideSupportLinks
      />
    ) : (
      <PageContent />
    );
  }
}

export default ProjectEventRedirect;
