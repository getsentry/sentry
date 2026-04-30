import {useEffect, useMemo} from 'react';

import {useLineCoverageContext} from 'sentry/components/events/interfaces/crashContent/exception/lineCoverageContext';
import {useSourceContext} from 'sentry/components/events/interfaces/frame/useSourceContext';
import {useStacktraceCoverage} from 'sentry/components/events/interfaces/frame/useStacktraceCoverage';
import {
  hasContextSource,
  hasPotentialSourceContext,
} from 'sentry/components/events/interfaces/frame/utils';
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
  const {hasScmSourceContext, project} = useStackTraceContext();
  const {hasCoverageData, setHasCoverageData} = useLineCoverageContext();
  const organization = useOrganization();

  const hasEmbeddedContext = hasContextSource(frame);
  const shouldFetchSourceContext =
    hasScmSourceContext &&
    defined(project) &&
    !hasEmbeddedContext &&
    isExpanded &&
    hasPotentialSourceContext(frame);

  const {data: sourceContextData, isPending: isLoadingSourceContext} = useSourceContext(
    {
      event,
      frame,
      orgSlug: organization.slug,
      projectSlug: project?.slug,
    },
    {enabled: shouldFetchSourceContext}
  );

  const scmContext = useMemo(() => {
    if (!sourceContextData?.context?.length) {
      return undefined;
    }
    return sourceContextData.context;
  }, [sourceContextData]);

  const effectiveContext = hasEmbeddedContext ? frame.context : scmContext;
  const contextLines = isExpanded ? (effectiveContext ?? []) : [];

  const {data: coverageData, isPending: isLoadingCoverage} = useStacktraceCoverage(
    {
      event,
      frame,
      orgSlug: organization.slug,
      projectSlug: project?.slug,
    },
    {
      enabled: isExpanded && defined(project) && !!organization.codecovAccess,
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

  return (
    <FrameContent
      sourceLineCoverage={sourceLineCoverage}
      effectiveContext={effectiveContext}
      isLoadingSourceContext={shouldFetchSourceContext && isLoadingSourceContext}
    />
  );
}
