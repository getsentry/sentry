import {useEffect, useState} from 'react';

import {RequestState} from 'sentry/types/core';
import {StacktraceLinkResult} from 'sentry/types/integrations';
import {Organization} from 'sentry/types/organization';
import {Project} from 'sentry/types/project';
import useApi from 'sentry/utils/useApi';

interface UseSourceCodeLinkProps {
  commitId: string | undefined;
  frame: {
    file: string | undefined;
    path: string | undefined;
  };
  organization: Organization;
  platform: string | undefined;
  project: Project | undefined;
}

export function useSourceCodeLink(
  props: UseSourceCodeLinkProps
): RequestState<StacktraceLinkResult> {
  const api = useApi();

  const [source, setSource] = useState<RequestState<StacktraceLinkResult>>({
    type: 'initial',
  });

  useEffect(() => {
    if (!props.platform || !props.commitId || !props.project?.slug) {
      return undefined;
    }

    if (!props.frame.file && !props.frame.path) {
      return undefined;
    }

    setSource({type: 'loading'});
    api
      .requestPromise(
        `/projects/${props.organization.slug}/${props.project.slug}/stacktrace-link/`,
        {
          query: {
            file: props.frame.file,
            platform: props.platform,
            commitId: props.commitId,
            ...(props.frame.path && {absPath: props.frame.path}),
          },
        }
      )
      .then(response => {
        setSource({type: 'resolved', data: response});
      })
      .catch(err => {
        setSource({type: 'errored', error: err});
      });

    return () => {
      api.clear();
    };
  }, [
    api,
    props.project?.slug,
    props.commitId,
    props.frame.file,
    props.frame.path,
    props.organization,
    props.platform,
  ]);

  return source;
}
