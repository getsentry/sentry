import {Stack} from '@sentry/scraps/layout';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {useParams} from 'sentry/utils/useParams';
import {InvestigationAccess} from 'sentry/views/investigations/detail/investigationAccess';
import {InvestigationPageContent} from 'sentry/views/investigations/detail/investigationPageContent';
import {useInvestigationDetail} from 'sentry/views/investigations/detail/useInvestigationDetail';
import {RouteError} from 'sentry/views/routeError';

export function InvestigationBootstrapPage({investigationId}: {investigationId: string}) {
  const {
    data: investigation,
    error,
    isError,
    isPending,
  } = useInvestigationDetail(investigationId);

  if (isPending && !investigation) {
    return <LoadingIndicator />;
  }
  if (isError && !investigation) {
    return (
      <Stack flex={1} padding="2xl 3xl">
        <RouteError error={error} />
      </Stack>
    );
  }
  if (!investigation) {
    return null;
  }

  return <InvestigationPageContent investigation={investigation} />;
}

export default function InvestigationDetailView() {
  const {investigationId} = useParams<{investigationId: string}>();

  return (
    <AnalyticsArea name="investigations.details" overrideParent>
      <InvestigationAccess>
        <InvestigationBootstrapPage investigationId={investigationId} />
      </InvestigationAccess>
    </AnalyticsArea>
  );
}
