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

type StackTraceFrame = NonNullable<StackTraceRootProps['stacktrace']['frames']>[number];

function hasCoverageEligibleFrameData(
  frame: StackTraceFrame | undefined
): frame is StackTraceFrame {
  return !!frame?.filename && frame.lineNo !== null && frame.lineNo !== undefined;
}

function getStacktraceCoverageQueryOptions(params: {
  event: StackTraceRootProps['event'];
  frame: StackTraceFrame;
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

  const expandedFrameCoverageQueries = useMemo(() => {
    if (!hasCodecovAccess || !organizationSlug || !projectSlug) {
      return [];
    }

    return Object.entries(expandedFrames)
      .filter(([_frameIndex, isExpanded]) => isExpanded)
      .flatMap(([frameIndex]) => {
        const frame = frames[Number(frameIndex)];

        if (!hasCoverageEligibleFrameData(frame) || !frame.context?.length) {
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
      });
  }, [event, expandedFrames, frames, hasCodecovAccess, organizationSlug, projectSlug]);

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
      const organizationSlug = organization?.slug;
      const projectSlug = project?.slug;

      if (
        !organization?.codecovAccess ||
        !organizationSlug ||
        !projectSlug ||
        !hasCoverageEligibleFrameData(frame) ||
        !frame.context?.length
      ) {
        return undefined;
      }

      const queryOptions = getStacktraceCoverageQueryOptions({
        event,
        frame,
        organizationSlug,
        projectSlug,
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
