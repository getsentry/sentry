import {StacktraceLinkResult} from 'sentry/types/integrations';
import {Organization} from 'sentry/types/organization';
import {Project} from 'sentry/types/project';
import {useApiQuery, UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';

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
): UseApiQueryResult<StacktraceLinkResult, RequestError> {
  return useApiQuery<StacktraceLinkResult>(
    [
      `/projects/${props.organization.slug}/${props.project?.slug}/stacktrace-link/`,
      {
        query: {
          file: props.frame.file,
          platform: props.platform,
          commitId: props.commitId,
          ...(props.frame.path && {absPath: props.frame.path}),
        },
      },
    ],
    {
      enabled: !!(
        props.project &&
        props.platform &&
        props.frame &&
        (props.frame.file || props.frame.path)
      ),
      staleTime: Infinity,
    }
  );
}
