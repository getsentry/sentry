import {useStacktraceCoverage} from 'sentry/components/events/interfaces/frame/useStacktraceCoverage';
import {FrameContent} from 'sentry/components/stackTrace/frame/frameContent';
import {
  useStackTraceContext,
  useStackTraceFrameContext,
} from 'sentry/components/stackTrace/stackTraceContext';
import {
  CodecovStatusCode,
  type Coverage,
  type LineCoverage,
} from 'sentry/types/integrations';
import {defined} from 'sentry/utils';
import useOrganization from 'sentry/utils/useOrganization';

function getLineCoverage(
  lines: Array<[number, string | null]>,
  lineCoverage: LineCoverage[]
): Array<Coverage | undefined> {
  const coverageByLine = new Map<number, Coverage>(lineCoverage);
  return lines.map(([lineNo]) => coverageByLine.get(lineNo));
}

export function IssueStackTraceFrameContext() {
  const {event, frame, isExpanded} = useStackTraceFrameContext();
  const {project} = useStackTraceContext();
  const organization = useOrganization({allowNull: true});

  const contextLines = isExpanded ? (frame.context ?? []) : [];

  const {data: coverageData, isPending: isLoadingCoverage} = useStacktraceCoverage(
    {
      event,
      frame,
      orgSlug: organization?.slug || '',
      projectSlug: project?.slug,
    },
    {
      enabled:
        isExpanded &&
        defined(organization) &&
        defined(project) &&
        !!organization.codecovAccess,
    }
  );

  const sourceLineCoverage =
    !isLoadingCoverage &&
    coverageData?.status === CodecovStatusCode.COVERAGE_EXISTS &&
    coverageData.lineCoverage
      ? getLineCoverage(contextLines, coverageData.lineCoverage)
      : [];

  if (!isExpanded) {
    return null;
  }

  return <FrameContent sourceLineCoverage={sourceLineCoverage} />;
}
