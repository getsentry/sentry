import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from 'sentry/components/button';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import type {ProfilingBreadcrumbsProps} from 'sentry/components/profiling/profilingBreadcrumbs';
import {ProfilingBreadcrumbs} from 'sentry/components/profiling/profilingBreadcrumbs';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import {trackAnalytics} from 'sentry/utils/analytics';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

interface ContinuousProfileHeader {
  projectId: string;
  transaction: Event | null;
}

export function ContinuousProfileHeader({
  transaction,
  projectId,
}: ContinuousProfileHeader) {
  const location = useLocation();
  const organization = useOrganization();

  // @TODO add breadcrumbs when other views are implemented
  const breadCrumbs = useMemo((): ProfilingBreadcrumbsProps['trails'] => {
    return [{type: 'landing', payload: {query: {}}}];
  }, []);

  const projectSlug = projectId ?? '';

  const transactionTarget = transaction?.id
    ? generateLinkToEventInTraceView({
        timestamp: transaction.endTimestamp ?? '',
        eventId: transaction.id,
        projectSlug,
        traceSlug: transaction.contexts?.trace?.trace_id ?? '',
        location,
        organization,
      })
    : null;

  const handleGoToTransaction = useCallback(() => {
    trackAnalytics('profiling_views.go_to_transaction', {
      organization,
      source: 'transaction_details',
    });
  }, [organization]);

  return (
    <SmallerLayoutHeader>
      <SmallerHeaderContent>
        <SmallerProfilingBreadcrumbsWrapper>
          <ProfilingBreadcrumbs organization={organization} trails={breadCrumbs} />
        </SmallerProfilingBreadcrumbsWrapper>
      </SmallerHeaderContent>
      <StyledHeaderActions>
        <FeedbackWidgetButton />
        {transactionTarget && (
          <LinkButton size="sm" onClick={handleGoToTransaction} to={transactionTarget}>
            {t('Go to Transaction')}
          </LinkButton>
        )}
      </StyledHeaderActions>
    </SmallerLayoutHeader>
  );
}

const StyledHeaderActions = styled(Layout.HeaderActions)`
  display: flex;
  flex-direction: row;
  gap: ${space(1)};
`;

const SmallerHeaderContent = styled(Layout.HeaderContent)`
  margin-bottom: ${space(1.5)};
`;

const SmallerProfilingBreadcrumbsWrapper = styled('div')`
  nav {
    padding-bottom: ${space(1)};
  }
`;

const SmallerLayoutHeader = styled(Layout.Header)`
  padding: ${space(1)} ${space(2)} 0 ${space(2)} !important;
`;
