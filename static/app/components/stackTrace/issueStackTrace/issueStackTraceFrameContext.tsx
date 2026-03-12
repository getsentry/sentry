import {useEffect} from 'react';

import {useLineCoverageContext} from 'sentry/components/events/interfaces/crashContent/exception/lineCoverageContext';
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
import {useOrganization} from 'sentry/utils/useOrganization';

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
  const {hasCoverageData, setHasCoverageData} = useLineCoverageContext();
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

  useEffect(() => {
    if (hasCoverageData) {
      return;
    }

    const frameHasCoverageData =
      !isLoadingCoverage && coverageData?.status === CodecovStatusCode.COVERAGE_EXISTS;
    if (frameHasCoverageData) {
      setHasCoverageData(true);
    }
  }, [coverageData, hasCoverageData, isLoadingCoverage, setHasCoverageData]);

  if (!isExpanded) {
    return null;
  }

  return <FrameContent sourceLineCoverage={sourceLineCoverage} />;
}
