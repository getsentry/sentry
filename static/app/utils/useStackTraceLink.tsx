import type {Organization, Project, StacktraceLinkResult} from 'sentry/types';
import {useQuery} from 'sentry/utils/queryClient';

interface UseStacktraceLinkProps {
  frame: {
    absPath?: string;
    filename?: string;
    module?: string;
    package?: string;
  };
  organization: Organization;
  project: Project;
  commitId?: string;
  organizationSlug?: string;
  platform?: string;
  sdkName?: string;
}

export function useStacktraceLink(options: UseStacktraceLinkProps) {
  const response = useQuery<StacktraceLinkResult>([
    `/projects/${options.organization.slug}/${options.project.slug}/stacktrace-link/`,
    {
      query: {
        file: options.frame.filename,
        platform: options.platform,
        commitId: options.commitId,
        ...(options.sdkName && {sdkName: options.sdkName}),
        ...(options.frame.absPath && {absPath: options.frame.absPath}),
        ...(options.frame.module && {module: options.frame.module}),
        ...(options.frame.package && {package: options.frame.package}),
      },
    },
  ]);

  return response;
}
