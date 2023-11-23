import {PageFilters} from 'sentry/types';
import {MetricMetaCodeLocation} from 'sentry/utils/metrics';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

export function useMetricsCodeLocations(
  mri: string | undefined,
  projects?: PageFilters['projects']
) {
  const {slug} = useOrganization();

  // const toReturn = {
  //   data: {
  //     codeLocations: [
  //       {
  //         mri,
  //         timestamp: 1700697600,
  //         frames: [
  //           {
  //             function: 'get',
  //             module: 'sentry.api.endpoints.organization_metrics',
  //             filename: 'sentry/api/endpoints/organization_baz.py',
  //             absPath:
  //               '/Users/ogi/repos/sentry/src/sentry/api/endpoints/organization_metrics.py',
  //             lineNo: 56,
  //           },
  //           {
  //             function: 'post',
  //             module: 'sentry.api.endpoints.organization_metrics',
  //             filename: 'sentry/api/endpoints/something.py',
  //             absPath:
  //               '/Users/ogi/repos/sentry/src/sentry/api/endpoints/organization_metrics.py',
  //             lineNo: 112,
  //           },
  //           {
  //             function: 'put',
  //             module: 'sentry.api.endpoints.organization_metrics',
  //             filename: 'sentry/api/endpoints/organization_metrics.py',
  //             absPath:
  //               '/Users/ogi/repos/sentry/src/sentry/api/endpoints/organization_metrics.py',
  //             lineNo: 324,
  //           },
  //           {
  //             function: 'patch',
  //             module: 'sentry.api.endpoints.organization_metrics',
  //             filename: 'sentry/api/endpoints/organization_bar.py',
  //             absPath:
  //               '/Users/ogi/repos/sentry/src/sentry/api/endpoints/organization_metrics.py',
  //             lineNo: 117,
  //           },
  //           {
  //             function: 'get',
  //             module: 'sentry.api.endpoints.organization_metrics',
  //             filename: 'sentry/api/endpoints/organization_foo.py',
  //             absPath:
  //               '/Users/ogi/repos/sentry/src/sentry/api/endpoints/organization_metrics.py',
  //             lineNo: 56,
  //           },
  //         ],
  //       } as MetricMetaCodeLocation,
  //       {
  //         mri,
  //         timestamp: 1700697600,
  //         frames: [
  //           {
  //             function: 'get',
  //             module: 'sentry.api.endpoints.organization_metrics',
  //             filename: 'sentry/api/endpoints/organization_metrics.py',
  //             absPath:
  //               '/Users/ogi/repos/sentry/src/sentry/api/endpoints/organization_metrics.py',
  //             lineNo: 56,
  //           },
  //         ],
  //       } as MetricMetaCodeLocation,
  //     ],
  //   },
  // };

  const {data, isLoading} = useApiQuery<{codeLocations: MetricMetaCodeLocation[]}>(
    [`/organizations/${slug}/ddm/meta/`, {query: {metric: mri, project: projects}}],
    {
      enabled: !!mri,
      staleTime: Infinity,
    }
  );

  // const transformedData = data?.codeLocations.map(codeLocation => {
  //   return {
  //     ...codeLocation,
  //     frames: codeLocation.frames.map(frame => {
  //       return {
  //         ...frame,
  //         abs_path: frame.absPath,
  //         lineno: frame.lineNo,
  //       };
  //     }),
  //   };
  // });

  return {data, isLoading};
}
