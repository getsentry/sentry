import {useCallback} from 'react';

import {IssueType} from 'sentry/types/group';
import {ORDER} from 'sentry/views/insights/browser/webVitals/components/charts/performanceScoreChart';
import type {ProjectData} from 'sentry/views/insights/browser/webVitals/components/webVitalMetersWithIssues';
import {useInvalidateWebVitalsIssuesQuery} from 'sentry/views/insights/browser/webVitals/queries/useWebVitalsIssuesQuery';
import type {ProjectScore} from 'sentry/views/insights/browser/webVitals/types';
import {useCreateIssue} from 'sentry/views/insights/browser/webVitals/utils/useCreateIssue';
import type {SpanFields, SpanResponse} from 'sentry/views/insights/types';

type WebVitalTraceSample = Pick<SpanResponse, SpanFields.TIMESTAMP | SpanFields.TRACE>;

type WebVitalTraceSamples = {
  cls?: WebVitalTraceSample;
  fcp?: WebVitalTraceSample;
  inp?: WebVitalTraceSample;
  lcp?: WebVitalTraceSample;
  ttfb?: WebVitalTraceSample;
};

// Creates a new issue for each web vital that has a score under 90 and runs seer autofix for each of them
// TODO: Add logic to actually initiate running autofix for each issue. Right now we rely on the project config to automatically run autofix for each issue.
export function useRunSeerAnalysis({
  projectScore,
  projectData,
  transaction,
  webVitalTraceSamples,
}: {
  transaction: string;
  webVitalTraceSamples: WebVitalTraceSamples;
  projectData?: ProjectData;
  projectScore?: ProjectScore;
}) {
  const {mutateAsync: createIssueAsync} = useCreateIssue();
  const invalidateWebVitalsIssuesQuery = useInvalidateWebVitalsIssuesQuery({
    transaction,
  });

  const runSeerAnalysis = useCallback(async (): Promise<string[]> => {
    if (!projectScore || !projectData) {
      return [];
    }
    const underPerformingWebVitals = ORDER.filter(webVital => {
      const score = projectScore[`${webVital}Score`];
      return score && score < 90;
    });
    const promises = underPerformingWebVitals.map(async webVital => {
      try {
        const result = await createIssueAsync({
          issueType: IssueType.WEB_VITALS,
          vital: webVital,
          score: projectScore[`${webVital}Score`],
          value: Math.round(projectData[`p75(measurements.${webVital})`]),
          transaction,
          traceId: webVitalTraceSamples[webVital]?.trace,
        });
        return result.event_id;
      } catch (error) {
        // If the issue creation fails, we don't want to fail the entire operation for the rest of the vitals
        return null;
      }
    });

    const results = await Promise.all(promises);
    invalidateWebVitalsIssuesQuery();
    return results.filter(id => id !== null);
  }, [
    createIssueAsync,
    projectScore,
    projectData,
    transaction,
    invalidateWebVitalsIssuesQuery,
    webVitalTraceSamples,
  ]);

  return runSeerAnalysis;
}
