import {Grid} from 'sentry/components/core/layout';
import {UrlParamBatchProvider} from 'sentry/utils/url/urlParamBatchContext';
import {BuildDetailsMainContent} from 'sentry/views/preprod/buildDetails/main/buildDetailsMainContent';
import {BuildDetailsSidebarContent} from 'sentry/views/preprod/buildDetails/sidebar/buildDetailsSidebarContent';

import {MOCK_APP_SIZE_DATA, MOCK_BUILD_DETAILS} from './mockBuildData';

export function SizeAnalysisView() {
  // Mock the useApiQuery result structure
  const mockAppSizeQuery = {
    data: MOCK_APP_SIZE_DATA,
    isLoading: false,
    isError: false,
    error: null,
    refetch: () => Promise.resolve({} as any),
    isPending: false,
    isSuccess: true,
    status: 'success' as const,
  };

  return (
    <UrlParamBatchProvider>
      <Grid areas={`"main sidebar"`} columns="1fr 325px" gap="3xl" padding="lg">
        <Grid area="main" style={{minWidth: 0}}>
          <BuildDetailsMainContent
            appSizeQuery={mockAppSizeQuery as any}
            buildDetailsData={MOCK_BUILD_DETAILS}
            onRerunAnalysis={() => {
              // eslint-disable-next-line no-console
              console.log('Rerun analysis clicked');
            }}
            isRerunning={false}
            isBuildDetailsPending={false}
          />
        </Grid>
        <Grid area="sidebar">
          <BuildDetailsSidebarContent
            buildDetailsData={MOCK_BUILD_DETAILS}
            isBuildDetailsPending={false}
            artifactId="mock-artifact-123"
            projectId="mock-project"
          />
        </Grid>
      </Grid>
    </UrlParamBatchProvider>
  );
}
