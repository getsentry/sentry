import {useQuery} from '@tanstack/react-query';
import type {UseQueryResult} from '@tanstack/react-query';

import {isUnlinkableFilename} from 'sentry/components/events/interfaces/frame/utils';
import type {StacktraceLinkResult} from 'sentry/types/integrations';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {apiOptions} from 'sentry/utils/api/apiOptions';

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
): UseQueryResult<StacktraceLinkResult> {
  return useQuery({
    ...apiOptions.as<StacktraceLinkResult>()(
      '/projects/$organizationIdOrSlug/$projectIdOrSlug/stacktrace-link/',
      {
        path: {
          organizationIdOrSlug: props.organization.slug,
          projectIdOrSlug: props.project?.slug!,
        },
        query: {
          file: props.frame.file,
          platform: props.platform,
          commitId: props.commitId,
          ...(props.frame.path && {absPath: props.frame.path}),
        },
        staleTime: Infinity,
      }
    ),
    enabled: !!(
      props.project &&
      props.platform &&
      props.frame &&
      (props.frame.file || props.frame.path) &&
      !isUnlinkableFilename(props.frame.file ?? '')
    ),
  });
}
