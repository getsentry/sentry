import {useCallback, useMemo} from 'react';
import {useQuery, useQueryClient} from '@tanstack/react-query';

import {buildStacktraceLinkQuery} from 'sentry/components/events/interfaces/frame/useStacktraceLink';
import {CodecovStatusCode, type CodecovResponse} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import {StackTrace} from './stackTrace';
import {useStackTraceContext} from './stackTraceContext';
import type {StackTraceRootProps} from './types';

function getStacktraceCoverageQueryOptions(params: {
  event: StackTraceRootProps['event'];
  frame: NonNullable<StackTraceRootProps['stacktrace']['frames']>[number];
  organizationSlug: string;
  projectSlug: string;
}) {
  const {event, frame, organizationSlug, projectSlug} = params;
  return apiOptions.as<CodecovResponse>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/stacktrace-coverage/',
    {
      path: {
        organizationIdOrSlug: organizationSlug,
        projectIdOrSlug: projectSlug,
      },
      query: buildStacktraceLinkQuery(event, frame),
      staleTime: Infinity,
    }
  );
}

function ExpandedFrameCoverageQuery({
  queryOptions,
}: {
  queryOptions: ReturnType<typeof getStacktraceCoverageQueryOptions>;
}) {
  useQuery({
    ...queryOptions,
    retry: false,
  });

  return null;
}

function CoverageDataLoader({
  hasCodecovAccess,
  organizationSlug,
  projectSlug,
}: {
  hasCodecovAccess: boolean;
  organizationSlug: string | undefined;
  projectSlug: string | undefined;
}) {
  const {event, expandedFrames, frames} = useStackTraceContext();

  const expandedFrameCoverageQueries = useMemo(
    () =>
      Object.entries(expandedFrames)
        .filter(([_frameIndex, isExpanded]) => isExpanded)
        .flatMap(([frameIndex]) => {
          const frame = frames[Number(frameIndex)];

          if (
            !hasCodecovAccess ||
            !organizationSlug ||
            !projectSlug ||
            !frame?.filename ||
            !frame.lineNo ||
            !frame.context?.length
          ) {
            return [];
          }

          return [
            {
              frameIndex: Number(frameIndex),
              queryOptions: getStacktraceCoverageQueryOptions({
                event,
                frame,
                organizationSlug,
                projectSlug,
              }),
            },
          ];
        }),
    [event, expandedFrames, frames, hasCodecovAccess, organizationSlug, projectSlug]
  );

  return expandedFrameCoverageQueries.map(({frameIndex, queryOptions}) => (
    <ExpandedFrameCoverageQuery key={frameIndex} queryOptions={queryOptions} />
  ));
}

type StackTraceWithCoverageDataProps = Omit<StackTraceRootProps, 'getFrameLineCoverage'>;

export function StackTraceWithCoverageData({
  children,
  ...stackTraceProps
}: StackTraceWithCoverageDataProps) {
  const queryClient = useQueryClient();
  const organization = useOrganization({allowNull: true});
  const {projects} = useProjects();
  const project = useMemo(
    () => projects.find(candidate => candidate.id === stackTraceProps.event.projectID),
    [projects, stackTraceProps.event.projectID]
  );

  const getFrameLineCoverage = useCallback<
    NonNullable<StackTraceRootProps['getFrameLineCoverage']>
  >(
    ({event, frame}) => {
      if (
        !organization?.codecovAccess ||
        !organization.slug ||
        !project?.slug ||
        !frame.filename ||
        !frame.lineNo ||
        !frame.context?.length
      ) {
        return undefined;
      }

      const queryOptions = getStacktraceCoverageQueryOptions({
        event,
        frame,
        organizationSlug: organization.slug,
        projectSlug: project.slug,
      });
      const coverageResponse = queryClient.getQueryData<CodecovResponse>(
        queryOptions.queryKey
      );

      if (
        coverageResponse?.status === CodecovStatusCode.COVERAGE_EXISTS &&
        coverageResponse.lineCoverage
      ) {
        return coverageResponse.lineCoverage;
      }

      return undefined;
    },
    [organization?.codecovAccess, organization?.slug, project?.slug, queryClient]
  );

  return (
    <StackTrace {...stackTraceProps} getFrameLineCoverage={getFrameLineCoverage}>
      <CoverageDataLoader
        hasCodecovAccess={!!organization?.codecovAccess}
        organizationSlug={organization?.slug}
        projectSlug={project?.slug}
      />
      {children}
    </StackTrace>
  );
}
