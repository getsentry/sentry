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
import {isSchema, isSentrySampledProfile} from 'sentry/utils/profiling/guards/profile';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useProfiles} from 'sentry/views/profiling/profilesProvider';

function getTransactionName(input: Profiling.ProfileInput): string {
  if (isSchema(input)) {
    return input.metadata.transactionName;
  }
  if (isSentrySampledProfile(input)) {
    return input.transaction.name || t('Unknown Transaction');
  }

  return t('Unknown Transaction');
}

interface ProfileHeaderProps {
  eventId: string;
  projectId: string;
  transaction: Event | null;
}

function ProfileHeader({transaction, projectId, eventId}: ProfileHeaderProps) {
  const location = useLocation();
  const organization = useOrganization();
  const profiles = useProfiles();

  const transactionName =
    profiles.type === 'resolved' ? getTransactionName(profiles.data) : '';
  const profileId = eventId ?? '';
  const projectSlug = projectId ?? '';

  const transactionTarget = transaction?.id
    ? generateLinkToEventInTraceView({
        timestamp: transaction.endTimestamp ?? '',
        eventId: transaction.id,
        projectSlug,
        traceSlug: transaction.contexts?.trace?.trace_id ?? '',
        location,
        organization,
        transactionName,
      })
    : null;

  const handleGoToTransaction = useCallback(() => {
    trackAnalytics('profiling_views.go_to_transaction', {
      organization,
      source: 'transaction_details',
    });
  }, [organization]);

  const breadcrumbTrails: ProfilingBreadcrumbsProps['trails'] = useMemo(() => {
    return [
      {type: 'landing', payload: {query: location.query}},
      {
        type: 'profile summary',
        payload: {
          projectSlug,
          transaction: transactionName,
          query: location.query,
        },
      },
      {
        type: 'flamechart',
        payload: {
          transaction: transactionName,
          profileId,
          projectSlug,
          query: location.query,
        },
      },
    ];
  }, [location, projectSlug, transactionName, profileId]);

  return (
    <SmallerLayoutHeader>
      <SmallerHeaderContent>
        <SmallerProfilingBreadcrumbsWrapper>
          <ProfilingBreadcrumbs organization={organization} trails={breadcrumbTrails} />
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

export {ProfileHeader};
