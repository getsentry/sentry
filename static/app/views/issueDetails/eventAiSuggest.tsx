import {Fragment, useEffect, useState} from 'react';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Organization, Project} from 'sentry/types';
import {Event} from 'sentry/types/event';
import marked from 'sentry/utils/marked';
import useApi from 'sentry/utils/useApi';

type Props = {
  event: Event;
  organization: Organization;
  project: Project;
};

export function EventAiSuggest({event, organization, project}: Props) {
  const api = useApi();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);
  const [suggestion, setSuggestion] = useState(null);

  useEffect(() => {
    let cancel = false;
    const endpoint = `/projects/${organization.slug}/${project.slug}/events/${event.id}/ai-suggest/`;

    setLoading(true);
    api
      .requestPromise(endpoint, {
        method: 'GET',
      })
      .then(result => {
        if (!cancel) {
          setSuggestion(result.suggestion);
        }
      })
      .catch(() => {
        if (!cancel) {
          setError(true);
        }
      })
      .finally(() => {
        setLoading(false);
      });
    return () => {
      cancel = true;
    };
  }, [organization.slug, project.slug, event.id, api]);

  if (loading) {
    return <LoadingIndicator />;
  }
  if (error) {
    return <LoadingError />;
  }
  if (suggestion) {
    return <div dangerouslySetInnerHTML={{__html: marked(suggestion)}} />;
  }
  return <Fragment />;
}
