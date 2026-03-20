import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import {LinkButton} from '@sentry/scraps/button';

import {FeedbackButton} from 'sentry/components/feedbackButton/feedbackButton';
import * as Layout from 'sentry/components/layouts/thirds';
import type {ProfilingBreadcrumbsProps} from 'sentry/components/profiling/profilingBreadcrumbs';
import {ProfilingBreadcrumbs} from 'sentry/components/profiling/profilingBreadcrumbs';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {trackAnalytics} from 'sentry/utils/analytics';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';

interface ContinuousProfileHeader {
  transaction: Event | null;
}

export function ContinuousProfileHeader({transaction}: ContinuousProfileHeader) {
  const location = useLocation();
  const organization = useOrganization();

  // @TODO add breadcrumbs when other views are implemented
  const breadCrumbs = useMemo((): ProfilingBreadcrumbsProps['trails'] => {
    return [{type: 'landing', payload: {query: {}}}];
  }, []);

  const transactionTarget = transaction?.id
    ? generateLinkToEventInTraceView({
        timestamp: transaction.endTimestamp ?? '',
        eventId: transaction.id,
        traceSlug: transaction.contexts?.trace?.trace_id ?? '',
        location,
        organization,
      })
    : null;

  const handleGoToTransaction = useCallback(() => {
    trackAnalytics('profiling_views.go_to_transaction', {
      organization,
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
        <FeedbackButton />
        {transactionTarget && (
          <LinkButton size="sm" onClick={handleGoToTransaction} to={transactionTarget}>
            {t('Go to Trace')}
          </LinkButton>
        )}
      </StyledHeaderActions>
    </SmallerLayoutHeader>
  );
}

const StyledHeaderActions = styled(Layout.HeaderActions)`
  display: flex;
  flex-direction: row;
  gap: ${p => p.theme.space.md};
`;

const SmallerHeaderContent = styled(Layout.HeaderContent)`
  margin-bottom: ${p => p.theme.space.lg};
`;

const SmallerProfilingBreadcrumbsWrapper = styled('div')`
  nav {
    padding-bottom: ${p => p.theme.space.md};
  }
`;

const SmallerLayoutHeader = styled(Layout.Header)`
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl} 0 ${p => p.theme.space.xl} !important;
`;
