import React from 'react';
import PropTypes from 'prop-types';

import {t} from 'app/locale';

/**
 * This component performs a client-side redirect to issue details -> event
 * details, given that it is loaded at the same URL (via the router) as the
 * server-side 302 redirect.
 */
class ProjectEventRedirect extends React.Component {
  static propTypes = {
    router: PropTypes.object,
  };

  constructor(props) {
    super(props);
    const {router} = props;

    // This presumes that this component/view is only reachable at
    // /:org/:project/events/:eventId.
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
      // responseURL is the URL of the document the browser ultimately loaded,
      // after following any redirects. It _should_ be the page we're trying
      // to reach; use the router to go there.

      // Use `replace` so that hitting the browser back button will skip all
      // this redirect business.
      router.replace(xhr.responseURL);
    };
    xhr.onerror = () => {
      throw new Error(t('An error occurred'));
    };
  }

  render() {
    return null;
  }
}

export default ProjectEventRedirect;
